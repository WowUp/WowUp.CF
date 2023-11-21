import {
  BehaviorSubject,
  catchError,
  debounceTime,
  from,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  zip,
} from "rxjs";
import { AddonProviderType } from "wowup-lib-core";

import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormGroup, UntypedFormControl } from "@angular/forms";
import { MatSelectionListChange } from "@angular/material/list";
import { TranslateService } from "@ngx-translate/core";

import { PREF_CF2_API_KEY, PREF_GITHUB_PERSONAL_ACCESS_TOKEN } from "../../../../common/constants";
import { AddonProviderState } from "../../../models/wowup/addon-provider-state";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { LinkService } from "../../../services/links/link.service";
import { SensitiveStorageService } from "../../../services/storage/sensitive-storage.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";

interface AddonProviderStateModel extends AddonProviderState {
  adRequired: boolean;
  providerNote?: string;
}

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit, OnDestroy {
  @ViewChild("prefForm", { read: ElementRef }) public prefForm!: ElementRef;

  private destroy$: Subject<boolean> = new Subject<boolean>();

  public addonProviderStates$ = new BehaviorSubject<AddonProviderStateModel[]>([]);

  public preferenceForm = new FormGroup({
    cfV2ApiKey: new UntypedFormControl(""),
    ghPersonalAccessToken: new UntypedFormControl(""),
  });

  public constructor(
    private _addonProviderService: AddonProviderFactory,
    private _sensitiveStorageService: SensitiveStorageService,
    private _translateService: TranslateService,
    private _dialogFactory: DialogFactory,
    private _linkService: LinkService,
  ) {
    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.loadProviderStates();
    });

    this.preferenceForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        switchMap((ch) => {
          const tasks: Observable<any>[] = [];
          if (typeof ch?.cfV2ApiKey === "string") {
            tasks.push(from(this._sensitiveStorageService.setAsync(PREF_CF2_API_KEY, ch.cfV2ApiKey)));
          }
          if (typeof ch?.ghPersonalAccessToken === "string") {
            tasks.push(
              from(this._sensitiveStorageService.setAsync(PREF_GITHUB_PERSONAL_ACCESS_TOKEN, ch.ghPersonalAccessToken)),
            );
          }
          return zip(tasks);
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        }),
      )
      .subscribe();
  }

  public ngOnInit(): void {
    this.loadProviderStates();
    this.loadSensitiveData().catch(console.error);
  }

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.prefForm?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  public ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();
  }

  public async onProviderStateSelectionChange(event: MatSelectionListChange): Promise<void> {
    for (const option of event.options) {
      const providerName: AddonProviderType = option.value;
      await this._addonProviderService.setProviderEnabled(providerName, option.selected);
    }
  }

  public onOpenLink = (element: HTMLAnchorElement): boolean => {
    this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };

  private async loadSensitiveData() {
    try {
      const cfV2ApiKey = await this._sensitiveStorageService.getAsync(PREF_CF2_API_KEY);
      const ghPersonalAccessToken = await this._sensitiveStorageService.getAsync(PREF_GITHUB_PERSONAL_ACCESS_TOKEN);

      this.preferenceForm.get("cfV2ApiKey").setValue(cfV2ApiKey);
      this.preferenceForm.get("ghPersonalAccessToken").setValue(ghPersonalAccessToken);
    } catch (e) {
      console.error(e);
    }
  }

  private loadProviderStates() {
    const providerStates = this._addonProviderService.getAddonProviderStates().filter((provider) => provider.canEdit);
    const providerStateModels: AddonProviderStateModel[] = providerStates.map((state) => {
      const provider = this._addonProviderService.getProvider(state.providerName);
      return { ...state, adRequired: provider.adRequired, providerNote: provider.providerNote };
    });

    this.addonProviderStates$.next(providerStateModels);
  }
}
