import { supabase } from "../supabaseClient";

export interface ReportRecord {
  id: string;
  name: string;
  timestamp: number;
  extractedData: Record<string, string | number>;
  predictions: Record<string, any>;
  explanations: Record<string, { explanation: string; precautions: string[] }>;
  imageSrc: string | null;
}

/**
 * Fetch all reports for the logged-in user, newest first
 */
export async function getReportHistory(): Promise<ReportRecord[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from("reports")
      .select("id, report_data, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      name: row.report_data?.name || "Medical Report",
      timestamp: new Date(row.created_at).getTime(),
      extractedData: row.report_data?.extracted_data || {},
      predictions: row.report_data?.predictions || {},
      explanations: row.report_data?.explanations || {},
      imageSrc: row.report_data?.imageSrc || null,
    }));
  } catch (e) {
    console.warn("getReportHistory error:", e);
    return [];
  }
}

/**
 * Fetch a single report by ID
 */
export async function getReportById(id: string): Promise<ReportRecord | null> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, report_data, created_at")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.report_data?.name || "Medical Report",
      timestamp: new Date(data.created_at).getTime(),
      extractedData: data.report_data?.extracted_data || {},
      predictions: data.report_data?.predictions || {},
      explanations: data.report_data?.explanations || {},
      imageSrc: data.report_data?.imageSrc || null,
    };
  } catch (e) {
    console.warn("getReportById error:", e);
    return null;
  }
}

/**
 * Delete a report by ID
 */
export async function deleteReportById(id: string): Promise<void> {
  try {
    await supabase.from("reports").delete().eq("id", id);
  } catch (e) {
    console.warn("deleteReportById error:", e);
  }
}

// Legacy no-ops kept so nothing breaks if still imported somewhere
export async function saveReportToHistory(): Promise<void> {}
export async function clearReportHistory(): Promise<void> {}