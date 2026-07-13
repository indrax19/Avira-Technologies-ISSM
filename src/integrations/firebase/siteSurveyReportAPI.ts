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
