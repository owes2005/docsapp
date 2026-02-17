export interface Document {
  id: string | number;
  workspaceId: string;
  title: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  isOwned?: boolean;
  folderId?: string | number | null;
}

export interface Folder {
  id: string | number;
  workspaceId: string;
  name: string;
  createdAt: string;
}
