// Root workspace container for a user's documents/projects.
export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  // Owner identity from auth provider/back-end user table.
  userId: string;
}
