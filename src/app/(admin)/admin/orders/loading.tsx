export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 rounded-md bg-gray-100 animate-pulse" />
      <div className="h-4 w-full rounded-md bg-gray-100 animate-pulse" />
      <div className="h-4 w-5/6 rounded-md bg-gray-100 animate-pulse" />
      <div className="h-4 w-4/6 rounded-md bg-gray-100 animate-pulse" />
      <div className="mt-4 h-64 w-full rounded-md bg-gray-100 animate-pulse" />
    </div>
  )
}
