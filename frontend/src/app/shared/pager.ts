import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  template: `
    @if (totalPages() > 1) {
      <div class="pager">
        <button class="btn btn-light" type="button" [disabled]="page() === 0" (click)="pageChange.emit(page() - 1)">Previous</button>
        <span>Page {{ page() + 1 }} of {{ totalPages() }} &middot; {{ totalElements() }} records</span>
        <button class="btn btn-light" type="button" [disabled]="page() + 1 >= totalPages()" (click)="pageChange.emit(page() + 1)">Next</button>
      </div>
    }
  `,
})
export class Pager {
  page = input.required<number>();
  totalPages = input.required<number>();
  totalElements = input.required<number>();
  pageChange = output<number>();
}
