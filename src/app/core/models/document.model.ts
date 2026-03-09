// Project-level grouping used by the sidebar and project screen.
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

// Folder lives inside one project and can contain many documents.
export interface Folder {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  createdAt: string;
}

// Document is the editable unit that owns pages.
export interface Document {
  id: string;
  workspaceId: string;
  projectId?: string;
  // Nullable when a document is not assigned to a folder.
  folderId?: string | null;
  title: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  // UI convenience flags (may be omitted by older records).
  isFavorite?: boolean;
  isOwned?: boolean;
}
