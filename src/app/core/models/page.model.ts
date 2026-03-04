export interface Page {
  id: string;
  documentId: string;
  title: string;
  icon?: string;
  order: number;
  parentId?: string | null;
  content: PageContent;
}

export interface PageContent {
  id?: string;
  blocks: ContentBlock[];
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  content?: any;
  order: number;
  level?: number;
  // Legacy fields kept for backward compatibility with old records.
  imageUrl?: string;
  imageCaption?: string;
  formatting?: TextFormatting;
}

export interface ImageBlockContent {
  url: string;
  caption?: string;
}

export type BlockType = 
  | 'heading' 
  | 'text' 
  | 'image'
  | 'gallery'
  | 'divider'


export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
}
