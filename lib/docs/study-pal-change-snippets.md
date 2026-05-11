# Study Pal change snippets

## `components/chat/ChatLayout.tsx`

```tsx
<main className="flex min-h-0 flex-1 items-center justify-center pt-0">
  <div className="h-full w-full max-w-6xl">
    ...
  </div>
</main>
```

## `components/chat/ChatArea.tsx`

```tsx
if (!selectedSessionId && messages.length === 0) {
  const statusResponse = await fetch(`/api/chat/material-status?courseId=${selectedCourseId}`);
  const statusPayload = await statusResponse.json();

  if (!statusPayload.hasMaterials) {
    setMaterialNotice(
      "No materials uploaded for this course yet. Upload notes, textbooks, slides, or PDFs first.",
    );
    return;
  }
}
```

## `components/chat/MessageBubble.tsx`

```tsx
const shellClass = isUser
  ? "ml-auto inline-flex w-fit max-w-[78vw] flex-col rounded-[1.6rem] bg-emerald-500 px-4 py-3 text-white sm:max-w-[34rem] sm:px-5"
  : "...";
```

## `app/api/chat/material-status/route.ts`

```ts
const { count, error: materialsError } = await supabase
  .from("course_materials")
  .select("id", { count: "exact", head: true })
  .eq("course_id", courseId);

return NextResponse.json({
  success: true,
  hasMaterials: (count ?? 0) > 0,
  materialsCount: count ?? 0,
});
```
