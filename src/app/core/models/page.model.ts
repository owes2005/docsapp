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
  blocks: ContentBlock[];
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  content?: any;
  order: number;
  level?: number;
  imageUrl?: string;
  imageCaption?: string;
  buttonLabel?: string;
  buttonActions?: any[];
  formatting?: TextFormatting;
}

export type BlockType = 
  | 'heading' 
  | 'text' 
  | 'image'
  | 'gallery'
  | 'divider'
  | 'code'
  | 'quote';

export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
}