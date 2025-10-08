export interface ProjectRow {
  id: string;
  name: string;
  selected_model: string | null;
  bvh_path: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

