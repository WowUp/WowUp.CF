import * as cfv2 from "curseforge-v2";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_CURSEFORGE } from "../../common/constants";
import { Addon } from "../../common/entities/addon";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { AddonChannelType } from "../../common/wowup/models";
import { AddonFolder } from "../models/wowup/addon-folder";
import { TocService } from "../services/toc/toc.service";
import { AddonProvider, GetAllBatchResult } from "./addon-provider";

const GAME_TYPE_LISTS = [
  {
    flavor: "wow_classic",
    typeId: 67408,
    matches: [WowClientType.ClassicEra, WowClientType.ClassicEraPtr],
  },
  {
    flavor: "wow-wrath-classic",
    typeId: 73713,
    matches: [WowClientType.Classic, WowClientType.ClassicPtr, WowClientType.ClassicBeta],
  },
  {
    flavor: "wow_retail",
    typeId: 517,
    matches: [WowClientType.Retail, WowClientType.RetailPtr, WowClientType.Beta],
  },
];

export class CurseAddonProvider extends AddonProvider {
  private readonly _cf2Client: cfv2.CFV2Client;

  public readonly name = ADDON_PROVIDER_CURSEFORGE;
  public readonly forceIgnore = false;

  public adRequired = true;
  public enabled = true;
  public allowEdit = true;

  constructor(private _tocService: TocService) {
    super();

    this._cf2Client = new cfv2.CFV2Client({
      apiKey: "$2a$10$KB/rroj2RVrwQs5t7WXyXOcG43YYCPasUh8i3y0c2FJ3vAT30dv32",
    });
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    if (!addonFolders.length) {
      return;
    }

    const scanResults = addonFolders.filter((af) => af.cfScanResults !== undefined).map((af) => af.cfScanResults!);

    const fingerprints = scanResults.map((sr) => sr.fingerprint);

    const result = await this._cf2Client.getFingerprintMatches({ fingerprints });
    const fingerprintData = result.data?.data;

    const matchPairs: { addonFolder: AddonFolder; match: cfv2.CF2FingerprintMatch; addon?: cfv2.CF2Addon }[] = [];
    for (let af of addonFolders) {
      let exactMatch = fingerprintData?.exactMatches.find(
        (em) =>
          this.isCfFileCompatible(installation.clientType, em.file) &&
          em.file.modules.some((m) => m.fingerprint == af.cfScanResults?.fingerprint)
      );

      // If the addon does not have an exact match, check the partial matches.
      if (!exactMatch && Array.isArray(fingerprintData?.partialMatches)) {
        exactMatch = fingerprintData!.partialMatches.find((partialMatch) =>
          partialMatch.file?.modules?.some((module) => module.fingerprint === af.cfScanResults?.fingerprint)
        );
      }

      if (exactMatch) {
        matchPairs.push({
          addonFolder: af,
          match: exactMatch,
        });
      }
    }

    const addonIds = matchPairs.map((mp) => mp.match.id);
    const getAddonsResult = await this._cf2Client.getMods({ modIds: addonIds });
    const addonResultData = getAddonsResult.data?.data;
    debugger;

    matchPairs.forEach((mp) => {
      const cfAddon = addonResultData?.find((ar) => ar.id === mp.match.id);
      if (!cfAddon) {
        return;
      }

      mp.addonFolder.matchingAddon = this.createAddon(installation, mp.match.file, cfAddon);
    });

    console.log(matchPairs);
  }

  public async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    const batchResult: GetAllBatchResult = {
      errors: {},
      installationResults: {},
    };

    if (!addonIds.length) {
      return batchResult;
    }

    debugger;

    const modResults = await this._cf2Client.getMods({
      modIds: addonIds.map((id) => parseInt(id, 10)),
    });

    for (const installation of installations) {
    }

    return batchResult;
  }

  private isCfFileCompatible(clientType: WowClientType, file: cfv2.CF2File): boolean {
    if (Array.isArray(file.sortableGameVersions) && file.sortableGameVersions.length > 0) {
      const gameVersionTypeId = this.getGameVersionTypeId(clientType);
      return this.hasSortableGameVersion(file, gameVersionTypeId);
    }

    return false;
  }

  private getGameVersionTypeId(clientType: WowClientType): number {
    const gameType = GAME_TYPE_LISTS.find((gtl) => gtl.matches.includes(clientType));
    if (!gameType) {
      throw new Error(`Game type not found: ${clientType}`);
    }

    return gameType.typeId;
  }

  private hasSortableGameVersion(file: cfv2.CF2File, typeId: number): boolean {
    if (!file.sortableGameVersions) {
      console.debug("sortableGameVersions missing", file);
    }
    return file.sortableGameVersions.some((sgv) => sgv.gameVersionTypeId === typeId);
  }

  private createAddon(installation: WowInstallation, cfFile: cfv2.CF2File, cfAddon: cfv2.CF2Addon): Addon {
    const authors = cfAddon.authors.map((author) => author.name).join(", ");
    const folders = cfFile.modules.map((module) => module.name);
    const folderList = folders.join(",");
    const latestFiles = this.getLatestFiles(cfAddon, installation.clientType);

    let channelType = this.getChannelType(cfFile.releaseType);
    let latestVersion = latestFiles.find((lf) => this.getChannelType(lf.releaseType) <= channelType);

    const addon: Addon = {
      id: uuidv4(),
      author: authors,
      name: cfAddon?.name ?? "unknown",
      channelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl: latestVersion?.downloadUrl ?? cfFile.downloadUrl ?? "",
      externalUrl: cfAddon?.links?.websiteUrl ?? "",
      externalId: cfAddon?.id.toString() ?? "",
      gameVersion: gameVersion,
      installedAt: new Date(scanResult.addonFolder?.fileStats?.birthtimeMs ?? 0),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: currentVersion.displayName,
      installedExternalReleaseId: currentVersion.id.toString(),
      isIgnored: false,
      latestVersion: latestVersion?.displayName ?? scanResult.exactMatch?.file.displayName ?? "",
      providerName: this.name,
      thumbnailUrl: cfAddon ? this.getThumbnailUrl(cfAddon) : "",
      screenshotUrls: cfAddon ? this.getScreenshotUrls(cfAddon) : [],
      downloadCount: cfAddon?.downloadCount ?? 0,
      summary: cfAddon?.summary ?? "",
      releasedAt: new Date(latestVersion?.fileDate ?? scanResult.exactMatch?.file.fileDate ?? ""),
      isLoadOnDemand: false,
      externalLatestReleaseId: (latestVersion?.id ?? scanResult.exactMatch?.file.id ?? "").toString(),
      updatedAt: scanResult.addonFolder?.fileStats?.birthtime ?? new Date(0),
      externalChannel: getEnumName(AddonChannelType, channelType),
      installationId: installation.id,
    };
  }

  private getLatestFiles(result: cfv2.CF2Addon, clientType: WowClientType): cfv2.CF2File[] {
    const filtered = result.latestFiles.filter(
      (latestFile) => latestFile.exposeAsAlternative !== true && this.isClientType(latestFile, clientType)
    );
    return _.sortBy(filtered, (latestFile) => latestFile.id).reverse();
  }

  private isClientType(file: cfv2.CF2File, clientType: WowClientType) {
    return this.isCfFileCompatible(clientType, file);
  }

  private getChannelType(releaseType: cfv2.CF2FileReleaseType): AddonChannelType {
    switch (releaseType) {
      case cfv2.CF2FileReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case cfv2.CF2FileReleaseType.Beta:
        return AddonChannelType.Beta;
      case cfv2.CF2FileReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }
  //   private async mapAddonFolders(scanResults: AppCurseV2ScanResult[], installation: WowInstallation) {
  //     if (!installation) {
  //       return;
  //     }

  //     const fingerprintResponse = await this.getAddonsByFingerprints(scanResults.map((result) => result.fingerprint));
  //     if (fingerprintResponse === undefined) {
  //       return;
  //     }

  //     for (const scanResult of scanResults) {
  //       // Curse can deliver the wrong result sometimes, ensure the result matches the client type
  //       scanResult.exactMatch = fingerprintResponse.exactMatches.find((exactMatch) => {
  //         const hasMatchingFingerprint = this.hasMatchingFingerprint(scanResult, exactMatch);
  //         const isCompatible = this.isCompatible(installation.clientType, exactMatch.file);
  //         return hasMatchingFingerprint && isCompatible;
  //       });

  //       // If the addon does not have an exact match, check the partial matches.
  //       if (!scanResult.exactMatch && fingerprintResponse.partialMatches) {
  //         scanResult.exactMatch = fingerprintResponse.partialMatches.find((partialMatch) =>
  //           partialMatch.file?.modules?.some((module) => module.fingerprint === scanResult.fingerprint)
  //         );
  //       }
  //     }
  //   }

  //   private getScanResults = (addonFolders: AddonFolder[]): AppCurseV2ScanResult[] => {
  //     const scanResults = addonFolders.map((af) => af.cfScanResults).filter((sr) => sr !== undefined);

  //     const appScanResults: AppCurseV2ScanResult[] = scanResults.map((scanResult) => {
  //       const addonFolder = addonFolders.find((af) => af.path === scanResult?.directory);

  //       return Object.assign({}, scanResult, { addonFolder });
  //     });

  //     return appScanResults;
  //   };
}
