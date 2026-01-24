// app/search-case-ids/loading.tsx
export default function SearchCaseIdsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-slate-600">در حال بارگذاری صفحه جستجوی پرونده...</p>
      </div>
    </div>
  );
}