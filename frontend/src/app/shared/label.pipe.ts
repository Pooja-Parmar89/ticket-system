import { Pipe, PipeTransform } from '@angular/core';

/** IN_PROGRESS -> "IN PROGRESS" */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return (value ?? '').replace(/_/g, ' ');
  }
}
