import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StupidLilLibrary } from './stupid-lil-library';

describe('StupidLilLibrary', () => {
  let component: StupidLilLibrary;
  let fixture: ComponentFixture<StupidLilLibrary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StupidLilLibrary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StupidLilLibrary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
