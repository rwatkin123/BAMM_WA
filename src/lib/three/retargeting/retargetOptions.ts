import * as THREE from "three";

export const targetToSourceName = {
  m_avg_root:   "Hips",
  m_avg_Pelvis: "Hips",
  m_avg_Spine1: "Spine",
  m_avg_Spine2: "Spine1",
  m_avg_Spine3: "Spine2",
  m_avg_Neck:   "Neck",
  m_avg_Head:   "Head",
  m_avg_L_Hip:   "LeftUpLeg",
  m_avg_L_Knee:  "LeftLeg",
  m_avg_L_Ankle: "LeftFoot",
  m_avg_L_Foot:  "LeftToe",
  m_avg_R_Hip:   "RightUpLeg",
  m_avg_R_Knee:  "RightLeg",
  m_avg_R_Ankle: "RightFoot",
  m_avg_R_Foot:  "RightToe",
  m_avg_L_Collar:   "LeftShoulder",
  m_avg_L_Shoulder: "LeftArm",
  m_avg_L_Elbow:    "LeftForeArm",
  m_avg_L_Wrist:    "LeftHand",
  m_avg_L_Hand:     "LeftHand",
  m_avg_R_Collar:   "RightShoulder",
  m_avg_R_Shoulder: "RightArm",
  m_avg_R_Elbow:    "RightForeArm",
  m_avg_R_Wrist:    "RightHand",
  m_avg_R_Hand:     "RightHand"
};

export const mixamoOffsetCache = new Map<string, Record<string, THREE.Matrix4>>();