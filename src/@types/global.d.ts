// Global type declarations. Types declared here are available in every file in the project without
// needing to be imported.

declare interface IndexEntry {
  term: string
  pageNumbers: string
  subentries?: {
    term: string
    pageNumbers: string
  }[]
}
