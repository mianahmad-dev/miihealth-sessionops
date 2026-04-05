const colorMap: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  published: "bg-green-100 text-green-800 border-green-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${colorMap[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {status}
    </span>
  );
}
