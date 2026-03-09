export interface Page {
  id: string;
  documentId: string;
  title: string;
  icon?: string;
  // Sort order in document page list.
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
  // Logical container id: multiple typed items can belong to one visual block group.
  blockId?: string;
  type: BlockType;
  content?: any;
  order: number;
  level?: number;
  // Legacy image fields preserved for backward compatibility with old payloads.
  imageUrl?: string;
  imageCaption?: string;
  formatting?: TextFormatting;
}

export interface ImageBlockContent {
  url: string;
  caption?: string;
}

// Storage-oriented nested shape used by persisted page payloads.
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
