import { Component, Input } from "@angular/core";
import { TestBedStatic } from "@angular/core/testing";
import { MatIcon, MatIconModule } from "@angular/material/icon";

@Component({
  selector: "mat-icon",
  template: "<span></span>",
})
export class MockMatIconComponent {
  @Input() public svgIcon: any;
  @Input() public fontSet: any;
  @Input() public fontIcon: any;
}


