import ClaimResourceLibraryScreen from '../ClaimResourceLibraryScreen'

type ClaimResourceCategoryPageProps = {
  params: Promise<{
    categoryId: string
  }>
}

export default async function ClaimResourceCategoryPage({
  params,
}: ClaimResourceCategoryPageProps) {
  const { categoryId } = await params

  return <ClaimResourceLibraryScreen focusCategoryId={categoryId} />
}
