import { RetargetResult } from "@/types/three";
import { retargetMixamoModel } from "./retargetMixamo";
import { retargetCustomModel } from "./retargetCustom";

export function retargetModel(source: any, targetModel: any, isMixamo: boolean = false, characterName: string): RetargetResult | null {
  if (isMixamo) {
    return retargetMixamoModel(source, targetModel, characterName);
  } else {
    return retargetCustomModel(source, targetModel);
  }
}

export { retargetMixamoModel, retargetCustomModel };