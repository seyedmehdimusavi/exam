import { Injectable, computed, inject, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { Collections, Infrastructure } from '../infrastructure/infrastructure';
import { Attempt, Category, Exam, ExamDraft, FamilyMember, Question, QuestionDraft, Subject } from '../models/models';
import { gradeAnswer, isPending, totalScore } from '../questions/grading';
import { normalizeDraft } from '../questions/question-rules';

/** Categories created the first time the app connects to an empty database. */
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'english', name: 'English', icon: 'translate', color: '#2a78d6', order: 1, subjects: [] },
  { id: 'geography', name: 'Geography', icon: 'public', color: '#eb6834', order: 2, subjects: [] },
  { id: 'visual-art', name: 'Visual Art', icon: 'palette', color: '#1baf7a', order: 3, subjects: [] },
  { id: 'science', name: 'Science', icon: 'science', color: '#eda100', order: 4, subjects: [] },
  { id: 'mathematics', name: 'Mathematics', icon: 'calculate', color: '#e87ba4', order: 5, subjects: [] },
];

/** Colours used before the chart palette was checked for colour-blind safety. */
const OLD_DEFAULT_COLORS = new Set(['#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b']);

/**
 * Holds all app data in signals. Pages read from here and call its actions;
 * actions persist through Infrastructure, and live Firestore listeners update the signals.
 */
@Injectable({ providedIn: 'root' })
export class AppState {
  private readonly infra = inject(Infrastructure);
  private listeners: Unsubscribe[] = [];

  // ---------- State ----------
  readonly currentUser = signal<FamilyMember | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly questions = signal<Question[]>([]);
  readonly exams = signal<Exam[]>([]);
  readonly attempts = signal<Attempt[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  // ---------- Selectors ----------
  readonly sortedCategories = computed(() =>
    [...this.categories()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
  );
  readonly categoryById = computed(() => new Map(this.categories().map((c) => [c.id, c])));
  readonly questionCountByCategory = computed(() => countBy(this.questions(), (q) => q.categoryId));
  readonly questionCountBySubject = computed(() => countBy(this.questions(), (q) => q.subjectId));
  readonly examCountByCategory = computed(() => countBy(this.exams(), (e) => e.categoryId));
  readonly questionById = computed(() => new Map(this.questions().map((q) => [q.id, q])));
  readonly examById = computed(() => new Map(this.exams().map((e) => [e.id, e])));
  readonly sortedExams = computed(() => [...this.exams()].sort((a, b) => b.createdAt - a.createdAt));
  readonly sortedAttempts = computed(() => [...this.attempts()].sort((a, b) => b.submittedAt - a.submittedAt));
  readonly attemptsByExam = computed(() => {
    const map = new Map<string, Attempt[]>();
    for (const a of this.sortedAttempts()) map.set(a.examId, [...(map.get(a.examId) ?? []), a]);
    return map;
  });
  readonly pendingAttempts = computed(() => this.sortedAttempts().filter((a) => a.gradingStatus === 'pending'));

  /** Family member for an email, falling back to the email itself for unknown accounts. */
  memberFor(email: string): FamilyMember {
    return (
      environment.family.find((m) => m.email.toLowerCase() === email.toLowerCase()) ?? { name: email, email }
    );
  }

  constructor() {
    this.infra.onAuthChange((user) => {
      this.stopSync();
      if (user?.email) {
        const email = user.email.toLowerCase();
        const member = environment.family.find((m) => m.email.toLowerCase() === email);
        this.currentUser.set(member ?? { name: email, email });
        this.startSync();
      } else {
        this.currentUser.set(null);
      }
    });
  }

  // ---------- Auth actions ----------
  signIn(email: string, pin: string) {
    return this.infra.signIn(email, pin);
  }

  signOut() {
    return this.infra.signOut();
  }

  // ---------- Category actions ----------
  async addCategory(name: string, icon: string, color: string) {
    const order = Math.max(0, ...this.categories().map((c) => c.order)) + 1;
    await this.infra.add<Category>(Collections.categories, { name: name.trim(), icon, color, order, subjects: [] });
  }

  async updateCategory(id: string, changes: Partial<Omit<Category, 'id'>>) {
    await this.infra.update<Category>(Collections.categories, id, changes);
  }

  /** Refuses to delete a category that still has questions or exams. */
  async deleteCategory(id: string) {
    if (this.questionCountByCategory().get(id) || this.examCountByCategory().get(id)) {
      throw new Error('This category still has questions or exams. Move or delete them first.');
    }
    await this.infra.remove(Collections.categories, id);
  }

  /** Adds a subject and returns it, or returns the existing one with the same name. */
  async addSubject(categoryId: string, name: string): Promise<Subject> {
    const category = this.requireCategory(categoryId);
    const trimmed = name.trim();
    const existing = category.subjects.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const subject: Subject = { id: crypto.randomUUID().slice(0, 8), name: trimmed };
    await this.updateCategory(categoryId, { subjects: [...category.subjects, subject] });
    return subject;
  }

  async renameSubject(categoryId: string, subjectId: string, name: string) {
    const category = this.requireCategory(categoryId);
    const subjects = category.subjects.map((s) => (s.id === subjectId ? { ...s, name: name.trim() } : s));
    await this.updateCategory(categoryId, { subjects });
  }

  async deleteSubject(categoryId: string, subjectId: string) {
    if (this.questionCountBySubject().get(subjectId)) {
      throw new Error('This subject still has questions. Move or delete them first.');
    }
    const category = this.requireCategory(categoryId);
    await this.updateCategory(categoryId, { subjects: category.subjects.filter((s) => s.id !== subjectId) });
  }

  // ---------- Question actions ----------
  async addQuestion(draft: QuestionDraft) {
    await this.addQuestions([draft]);
  }

  /** Saves many questions at once (Excel upload), creating any new subjects first. */
  async addQuestions(drafts: QuestionDraft[]): Promise<number> {
    const subjectIds = await this.resolveSubjects(drafts);
    const createdBy = this.currentUser()?.email ?? '';
    const now = Date.now();
    const questions = drafts.map((raw, i) => {
      const { subjectName, ...d } = normalizeDraft(raw);
      return { ...d, subjectId: subjectIds.get(subjectKey(d.categoryId, subjectName))!, createdBy, createdAt: now + i };
    });
    await this.infra.addMany<Question>(Collections.questions, questions);
    return questions.length;
  }

  async updateQuestion(id: string, draft: QuestionDraft) {
    const subjectIds = await this.resolveSubjects([draft]);
    const { subjectName, ...d } = normalizeDraft(draft);
    await this.infra.update<Question>(Collections.questions, id, {
      ...d,
      subjectId: subjectIds.get(subjectKey(d.categoryId, subjectName))!,
    });
  }

  async deleteQuestion(id: string) {
    const exam = this.exams().find((e) => e.questionIds.includes(id));
    if (exam) throw new Error(`This question is used in the exam "${exam.title}". Remove it from the exam first.`);
    await this.infra.remove(Collections.questions, id);
  }

  /**
   * Maps each draft's category + subject name to a subject id, adding missing
   * subjects with one write per category.
   */
  private async resolveSubjects(drafts: QuestionDraft[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    const byCategory = new Map<string, Set<string>>();
    for (const d of drafts) {
      const names = byCategory.get(d.categoryId) ?? new Set<string>();
      names.add(d.subjectName.trim());
      byCategory.set(d.categoryId, names);
    }
    for (const [categoryId, names] of byCategory) {
      const category = this.requireCategory(categoryId);
      const subjects = [...category.subjects];
      for (const name of names) {
        let subject = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (!subject) {
          subject = { id: crypto.randomUUID().slice(0, 8), name };
          subjects.push(subject);
        }
        ids.set(subjectKey(categoryId, name), subject.id);
      }
      if (subjects.length !== category.subjects.length) await this.updateCategory(categoryId, { subjects });
    }
    return ids;
  }

  // ---------- Exam actions ----------
  async saveExam(exam: ExamDraft, id?: string): Promise<string> {
    if (id) {
      await this.infra.update<Exam>(Collections.exams, id, exam);
      return id;
    }
    return this.infra.add<Exam>(Collections.exams, {
      ...exam,
      createdBy: this.currentUser()?.email ?? '',
      createdAt: Date.now(),
    });
  }

  /** Deletes an exam together with its results. */
  async deleteExam(id: string) {
    for (const attempt of this.attemptsByExam().get(id) ?? []) {
      await this.infra.remove(Collections.attempts, attempt.id);
    }
    await this.infra.remove(Collections.exams, id);
  }

  // ---------- Attempt actions ----------
  /** Marks and saves an online attempt; returns the new attempt id. */
  async submitAttempt(exam: Exam, answers: Record<string, string[]>, startedAt: number): Promise<string> {
    const questions = exam.questionIds.map((id) => this.questionById().get(id)).filter((q) => !!q);
    const graded = questions.map((q) => gradeAnswer(q, answers[q.id] ?? []));
    return this.infra.add<Attempt>(Collections.attempts, {
      examId: exam.id,
      takenBy: this.currentUser()?.email ?? '',
      answers: graded,
      totalScore: totalScore(graded),
      maxScore: questions.reduce((sum, q) => sum + q.score, 0),
      gradingStatus: isPending(graded) ? 'pending' : 'graded',
      source: 'online',
      startedAt,
      submittedAt: Date.now(),
    });
  }

  /** Saves marks for essay (or any) answers and recalculates the total. */
  async gradeAttempt(attempt: Attempt, grades: Record<string, { score: number; feedback: string }>) {
    const answers = attempt.answers.map((a) => {
      const grade = grades[a.questionId];
      if (!grade) return a;
      const max = this.questionById().get(a.questionId)?.score ?? grade.score;
      const score = Math.max(0, Math.min(max, grade.score));
      const { feedback: _old, ...rest } = a;
      const feedback = grade.feedback.trim();
      // Firestore rejects undefined inside arrays, so leave the key out when empty.
      return { ...rest, score, isCorrect: score >= max, ...(feedback ? { feedback } : {}) };
    });
    await this.infra.update<Attempt>(Collections.attempts, attempt.id, {
      answers,
      totalScore: totalScore(answers),
      gradingStatus: isPending(answers) ? 'pending' : 'graded',
    });
  }

  /** Paper exam results entered from Excel. */
  async addManualAttempts(attempts: Omit<Attempt, 'id'>[]) {
    await this.infra.addMany<Attempt>(Collections.attempts, attempts);
  }

  async deleteAttempt(id: string) {
    await this.infra.remove(Collections.attempts, id);
  }

  // ---------- Sync ----------
  private startSync() {
    this.error.set(null);
    const onError = (e: Error) => this.error.set(e.message);
    let seeded = false;
    this.listeners = [
      this.infra.watch<Category>(
        Collections.categories,
        (items) => {
          this.categories.set(items);
          this.loaded.set(true);
          if (items.length === 0 && !seeded) {
            seeded = true;
            this.seedDefaults();
          }
          this.migrateOldColors(items);
        },
        onError,
      ),
      this.infra.watch<Question>(Collections.questions, (items) => this.questions.set(items), onError),
      this.infra.watch<Exam>(Collections.exams, (items) => this.exams.set(items), onError),
      this.infra.watch<Attempt>(Collections.attempts, (items) => this.attempts.set(items), onError),
    ];
  }

  private stopSync() {
    this.listeners.forEach((stop) => stop());
    this.listeners = [];
    this.categories.set([]);
    this.questions.set([]);
    this.exams.set([]);
    this.attempts.set([]);
    this.loaded.set(false);
  }

  /** Fixed ids make seeding idempotent if two devices do it at once. */
  private async seedDefaults() {
    for (const { id, ...data } of DEFAULT_CATEGORIES) {
      await this.infra.set<Category>(Collections.categories, id, data);
    }
  }

  /** Moves the default categories from their first colours to the checked chart palette. */
  private migrateOldColors(categories: Category[]) {
    for (const c of categories) {
      const target = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
      if (target && OLD_DEFAULT_COLORS.has(c.color)) this.updateCategory(c.id, { color: target.color });
    }
  }

  private requireCategory(id: string): Category {
    const category = this.categoryById().get(id);
    if (!category) throw new Error('Category not found.');
    return category;
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

function subjectKey(categoryId: string, subjectName: string): string {
  return `${categoryId}|${subjectName.trim().toLowerCase()}`;
}
