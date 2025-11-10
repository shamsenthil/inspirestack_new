import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Trash2, AlertCircle } from "lucide-react";
import { CATEGORIES } from "@/constants/categories";
import ApiService from "@/services/ApiService";
import { validateUrl, simulateDelay } from "@/utils/helpers";

interface EditPostModalProps {
  item: any;
  open: boolean;
  onClose: () => void;
  onSubmit: (item: any, updateData: any) => void;
}

export default function EditPostModal({
  item,
  open,
  onClose,
  onSubmit,
}: EditPostModalProps) {
  const [title, setTitle] = useState(item?.title || "");
  const [content, setContent] = useState(item?.content || "");
  const [author, setAuthor] = useState(item?.author || "");
  const [url, setUrl] = useState(item?.url || "");
  const [category, setCategory] = useState(item?.category || "mindset");
  const [tags, setTags] = useState(item?.tags?.join(", ") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ✅ Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    if (item?.type === "book" && !author.trim())
      newErrors.author = "Author is required for books";
    if ((item?.type === "article" || item?.type === "video") && !validateUrl(url))
      newErrors.url = "Valid URL is required";
    if (item?.type === "prompt" && !content.trim())
      newErrors.content = "Prompt content is required";

    return newErrors;
  };

  // ✅ Handle Submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    await simulateDelay(1000);

    const updatedItem = {
      title: title.trim(),
      content: content.trim(),
      type: item.type,
      author: author.trim(),
      url: url.trim(),
      category,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    const response = await ApiService.updateContent(item.id, updatedItem);
    if (response.status === 200) {
      onSubmit(item, updatedItem);
    }

    setIsLoading(false);
    onClose();
  };

  // ✅ Handle Delete Confirm
  const handleDeletePost = async () => {
    setIsLoading(true);
    const response = await ApiService.deleteContent(item.id, item.type);
    if (response.status === 200) {
      onSubmit(item, null);
    }
    setIsLoading(false);
    setShowDeleteDialog(false);
    onClose();
  };

  return (
    <>
      {/* ✏️ Edit Modal */}
      <Dialog open={open} onOpenChange={(v) => !v && !isLoading && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update your post details</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 🧩 Title */}
            <div className="space-y-1">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
                }}
                placeholder="Enter title"
                className={errors.title ? "border-red-300 focus:border-red-500" : ""}
              />
              {errors.title && (
                <p className="text-red-600 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* 🧩 Content / Prompt */}
            {(item.type === "quote" ||
              item.type === "book" ||
              item.type === "prompt") && (
              <div className="space-y-1">
                <Label htmlFor="edit-content">
                  {item.type === "prompt" ? "Prompt Content *" : "Content"}
                </Label>
                <Textarea
                  id="edit-content"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (errors.content)
                      setErrors((prev) => ({ ...prev, content: null }));
                  }}
                  placeholder={
                    item.type === "prompt"
                      ? "Enter your AI prompt"
                      : "Enter content"
                  }
                  rows={4}
                  className={
                    errors.content ? "border-red-300 focus:border-red-500" : ""
                  }
                />
                {errors.content && (
                  <p className="text-red-600 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.content}
                  </p>
                )}
              </div>
            )}

            {/* 🧩 Author */}
            {(item.type === "book" || item.type === "quote") && (
              <div className="space-y-1">
                <Label htmlFor="edit-author">
                  Author {item.type === "book" ? "*" : ""}
                </Label>
                <Input
                  id="edit-author"
                  value={author}
                  onChange={(e) => {
                    setAuthor(e.target.value);
                    if (errors.author)
                      setErrors((prev) => ({ ...prev, author: null }));
                  }}
                  placeholder="Enter author name"
                  className={
                    errors.author ? "border-red-300 focus:border-red-500" : ""
                  }
                />
                {errors.author && (
                  <p className="text-red-600 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.author}
                  </p>
                )}
              </div>
            )}

            {/* 🧩 URL */}
            {(item.type === "article" ||
              item.type === "video" ||
              item.type === "book") && (
              <div className="space-y-1">
                <Label htmlFor="edit-url">
                  URL{" "}
                  {(item.type === "article" || item.type === "video") && "*"}
                </Label>
                <Input
                  id="edit-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errors.url) setErrors((prev) => ({ ...prev, url: null }));
                  }}
                  placeholder="https://example.com"
                  className={errors.url ? "border-red-300 focus:border-red-500" : ""}
                />
                {errors.url && (
                  <p className="text-red-600 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.url}
                  </p>
                )}
              </div>
            )}

            {/* 🧩 Category */}
            <div className="space-y-1">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.filter((c: any) => c.id !== "all").map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 🧩 Tags */}
            <div className="space-y-1">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="productivity, mindset, habits"
              />
            </div>

            {/* 🧩 Footer Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-slate-100 text-white dark:text-slate-900"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Post
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🗑️ Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(v) => !v && !isLoading && setShowDeleteDialog(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePost}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Post
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
