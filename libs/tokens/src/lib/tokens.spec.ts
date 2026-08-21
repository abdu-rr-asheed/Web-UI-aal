import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tokens } from './tokens';

describe('Tokens', () => {
  let component: Tokens;
  let fixture: ComponentFixture<Tokens>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tokens],
    }).compileComponents();

    fixture = TestBed.createComponent(Tokens);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
