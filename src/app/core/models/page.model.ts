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
  // Logical container id: multiple typed items can belong to one block group.
  blockId?: string;
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

// Storage-oriented nested structure.
export interface ContentBlockGroup {
  blockId: string;
  order: number;
  items: ContentBlockItem[];
}

export interface ContentBlockItem {
  itemId: string;
  type: BlockType;
  content?: any;
  url?: string;
  caption?: string;
  level?: number | null;
  order: number;
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
