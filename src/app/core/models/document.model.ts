export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  createdAt: string;
}

export interface Document {
  id: string;
  workspaceId: string;
  projectId?: string;
  folderId?: string | null;
  title: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  isOwned?: boolean;
}