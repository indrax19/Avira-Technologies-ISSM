import { db } from "./config";
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface GateWiseSurveyItem {
  id?: string;
  gateName: string;
  function: string;
  cameraRequired: string;
  notes: string;
}

export interface NetworkCablingItem {
  id?: string;
  item: string;
  quantity: string;
  purpose: string;
}

export interface SiteSurveyReport {
  id?: string;
  clientFacility: string;
  focalPerson: string;
  contactNumber: string;
  projectScope: string;
  surveyType: string;
  reportDate: string;
  preparedBy: string;
  facilityOverview: string;
  gateWiseSummary: GateWiseSurveyItem[];
  networkCablingRequirements: NetworkCablingItem[];
  created_at?: string;
  updated_at?: string;
}

export interface BlowRoomEntry {
  id: string;
  blowRoomNo: string;
  entryPoints: string;
  cameraLocation: string;
  lightingCondition: string;
}

export interface TextileSurveyReport {
  id?: string;
  category: "textile";

  // Display fields for list view
  clientFacility?: string;
  focalPerson?: string;
  contactNumber?: string;
  reportDate?: string;

  // 1. Mill/Facility Identification
  millName: string;
  unitName: string;
  fullAddress: string;
  totalUnits: string;
  surveyDate: string;
  surveyedByName: string;
  surveyedByDesignation: string;
  millContactPerson: string;
  millContactNumber: string;

  // 2. Blow Room Inventory & Camera Coverage
  blowRooms: BlowRoomEntry[];
  totalBlowRooms: string;
  totalEntryPoints: string;

  // 3. Waste Flow & Entry-Point Cross-Contamination
  wasteFlowOption: "" | "dedicated" | "shared" | "recycling";
  wasteFlowRemarks: string;

  // 4. Network & Internet Connectivity
  internetAvailable: boolean;
  connectionTypes: string[];
  connectionTypesOther: string;
  uplinkAvailable: boolean;
  bandwidthOption: "" | "10gb" | "20gb";
  internetQuality: string;
  ispProviderName: string;
  uplinkAtCamera: "" | "yes" | "no";
  distanceToNearestPoint: string;

  // 5. Power Infrastructure
  upsAvailable: boolean;
  cameraSocket: boolean;
  converterSocket: boolean;
  switchSocket: boolean;
  upsCapacity: string;
  upsBackupTime: string;

  // 6. GPU / Compute & Equipment Sizing
  gpuCompute: string;

  // 7. General Site Remarks / Additional Observations
  generalRemarks: string;

  // Signatures
  surveyorSignature: string;
  surveyorSignatureDate: string;
  customerRepresentativeSignature: string;
  customerRepresentativeSignatureDate: string;

  created_at?: string;
  updated_at?: string;
}

export const siteSurveyReportAPI = {
  async getAll() {
    try {
      const q = query(
        collection(db, "site_survey_reports"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SiteSurveyReport[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  async getById(id: string) {
    try {
      const docRef = doc(db, "site_survey_reports", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SiteSurveyReport;
      }
      return null;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  async create(report: SiteSurveyReport) {
    try {
      const data = removeUndefined({
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "site_survey_reports"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create survey report"
      );
    }
  },

  async update(id: string, report: Partial<SiteSurveyReport>) {
    try {
      const data = removeUndefined({
        ...report,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "site_survey_reports", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update survey report"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "site_survey_reports", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete survey report"
      );
    }
  },

  subscribeById(id: string, callback: (report: SiteSurveyReport | null) => void): Unsubscribe {
    try {
      const docRef = doc(db, "site_survey_reports", id);
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as SiteSurveyReport);
        } else {
          callback(null);
        }
      });
    } catch (error: any) {
      handleFirestoreError(error);
      return () => {};
    }
  },
};

export const textileSurveyReportAPI = {
  async getAll() {
    try {
      const q = query(
        collection(db, "site_survey_reports"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .filter((doc) => doc.data().category === "textile")
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TextileSurveyReport[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  async getById(id: string) {
    try {
      const docRef = doc(db, "site_survey_reports", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().category === "textile") {
        return { id: docSnap.id, ...docSnap.data() } as TextileSurveyReport;
      }
      return null;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  async create(report: TextileSurveyReport) {
    try {
      const data = removeUndefined({
        ...report,
        clientFacility: report.millName,
        focalPerson: report.surveyedByName,
        contactNumber: report.millContactNumber,
        reportDate: report.surveyDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "site_survey_reports"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create textile survey report"
      );
    }
  },

  async update(id: string, report: Partial<TextileSurveyReport>) {
    try {
      const updateData: any = {
        ...report,
        updated_at: new Date().toISOString(),
      };

      if (report.millName) updateData.clientFacility = report.millName;
      if (report.surveyedByName) updateData.focalPerson = report.surveyedByName;
      if (report.millContactNumber) updateData.contactNumber = report.millContactNumber;
      if (report.surveyDate) updateData.reportDate = report.surveyDate;

      const data = removeUndefined(updateData);
      const docRef = doc(db, "site_survey_reports", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update textile survey report"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "site_survey_reports", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete textile survey report"
      );
    }
  },

  subscribeById(id: string, callback: (report: TextileSurveyReport | null) => void): Unsubscribe {
    try {
      const docRef = doc(db, "site_survey_reports", id);
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().category === "textile") {
          callback({ id: docSnap.id, ...docSnap.data() } as TextileSurveyReport);
        } else {
          callback(null);
        }
      });
    } catch (error: any) {
      handleFirestoreError(error);
      return () => {};
    }
  },
};
