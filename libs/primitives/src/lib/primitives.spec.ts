import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Primitives } from './primitives';

describe('Primitives', () => {
  let component: Primitives;
  let fixture: ComponentFixture<Primitives>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Primitives],
    }).compileComponents();

    fixture = TestBed.createComponent(Primitives);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
