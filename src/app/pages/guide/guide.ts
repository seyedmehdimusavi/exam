import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** How to use every page. Static content; kept next to the pages it describes. */
@Component({
  selector: 'app-guide',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class Guide {
  protected readonly quickStart = [
    { icon: 'category', title: 'Categories', text: 'Check categories and subjects', link: '/categories' },
    { icon: 'edit_note', title: 'Add questions', text: 'One by one, or bulk from Excel', link: '/create-question' },
    { icon: 'quiz', title: 'Build an exam', text: 'Pick or randomise questions', link: '/exams/new' },
    { icon: 'insights', title: 'Take & track', text: 'See results and progress', link: '/today' },
  ];

  protected readonly sections = [
    { id: 'sign-in', title: 'Signing in', icon: 'login' },
    { id: 'categories', title: 'Categories', icon: 'category' },
    { id: 'create', title: 'Add a question', icon: 'edit_note' },
    { id: 'upload', title: 'Excel upload', icon: 'upload_file' },
    { id: 'exams', title: 'Build an exam', icon: 'quiz' },
    { id: 'take', title: 'Take an exam', icon: 'play_arrow' },
    { id: 'marking', title: 'Marking', icon: 'rate_review' },
    { id: 'today', title: 'Today', icon: 'today' },
    { id: 'progress', title: 'Progress', icon: 'trending_up' },
    { id: 'report', title: 'Report', icon: 'assessment' },
    { id: 'faq', title: 'Q&A', icon: 'help' },
  ];

  protected jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
