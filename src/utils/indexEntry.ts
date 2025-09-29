// TODO: Use a global type declaration file instead of this

export default interface IndexEntry {
  term: string
  pageNumbers: string
  subentries?: {
    term: string
    pageNumbers: string
  }[]
}
