import { Injectable } from "@angular/core";

import { PREFERENCE_STORE_NAME } from "../../../common/constants";
import { StorageService } from "./storage.service";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class PreferenceStorageService extends StorageService {
  protected readonly storageName = PREFERENCE_STORE_NAME;

  public constructor(electronService: ElectronService) {
    super(electronService);
  }
}

