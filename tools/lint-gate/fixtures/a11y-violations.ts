import { Component } from '@angular/core';
import { AalButton } from '@aal/components';

@Component({ selector: 'wrong-prefix', templateUrl: './a11y-violations.html' })
export class Bad {
  go(): any { return AalButton; }
}
