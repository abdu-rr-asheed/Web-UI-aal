import { ComponentFixture, TestBed } from '@angular/core/testing';
import { A11yCore } from './a11y-core';

describe('A11yCore', () => {
  let component: A11yCore;
  let fixture: ComponentFixture<A11yCore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [A11yCore],
    }).compileComponents();

    fixture = TestBed.createComponent(A11yCore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
