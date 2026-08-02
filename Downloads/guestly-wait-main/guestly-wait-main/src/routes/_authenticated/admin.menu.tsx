import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated/admin/menu")({
  component: MenuAdmin,
});

type Category = { id: string; name: string; sort_order: number };
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  is_available: boolean;
  sort_order: number;
  menu_categories: { name: string } | null;
};

type ItemForm = {
  name: string;
  description: string;
  price: string;
  category_id: string;
};

const emptyItemForm: ItemForm = { name: "", description: "", price: "", category_id: "" };

function MenuAdmin() {
  const qc = useQueryClient();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("id,name,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, menu_categories(name)")
        .order("sort_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { category: Category | null; items: MenuItem[] }>();
    for (const cat of categories) map.set(cat.id, { category: cat, items: [] });
    map.set("__uncategorized__", { category: null, items: [] });
    for (const item of items) {
      const key = item.category_id ?? "__uncategorized__";
      if (!map.has(key)) map.set(key, { category: null, items: [] });
      map.get(key)!.items.push(item);
    }
    return [...map.entries()].filter(([, g]) => g.category || g.items.length > 0);
  }, [categories, items]);

  async function toggleAvailability(id: string, value: boolean) {
    const { error } = await supabase.from("menu_items").update({ is_available: value }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["menu-items"] });
    toast.success(value ? "Item back on menu" : "Item marked out of stock");
  }

  async function saveCategory() {
    if (!categoryName.trim()) return toast.error("Category name is required");
    setSaving(true);
    const sortOrder = categories.length;
    const { error } = await supabase
      .from("menu_categories")
      .insert({ name: categoryName.trim(), sort_order: sortOrder });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Category added");
    setCategoryName("");
    setCategoryOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["menu-categories"] });
  }

  function openAddItem() {
    setEditingItem(null);
    setItemForm({
      ...emptyItemForm,
      category_id: categories[0]?.id ?? "",
    });
    setItemOpen(true);
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category_id: item.category_id ?? "",
    });
    setItemOpen(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim()) return toast.error("Item name is required");
    const price = Number(itemForm.price);
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid price");

    setSaving(true);
    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      price,
      category_id: itemForm.category_id || null,
    };

    const { error } = editingItem
      ? await supabase.from("menu_items").update(payload).eq("id", editingItem.id)
      : await supabase
          .from("menu_items")
          .insert({ ...payload, sort_order: items.length, is_available: true });

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingItem ? "Item updated" : "Item added");
    setItemOpen(false);
    setEditingItem(null);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["menu-items"] });
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", deleteItem.id);
    if (error) return toast.error(error.message);
    toast.success("Item deleted");
    setDeleteItem(null);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["menu-items"] });
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Menu management</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Category
          </Button>
          <Button size="sm" onClick={openAddItem}>
            <Plus className="mr-1 h-4 w-4" /> Add Menu Item
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {grouped.map(([key, group]) => (
          <section key={key}>
            <h2 className="mb-3 font-display text-lg font-semibold">
              {group.category?.name ?? "Uncategorized"}
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="surface-card rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <p className="mt-2 font-display text-lg font-semibold text-primary">
                        {money(item.price)}
                      </p>
                    </div>
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={(v) => toggleAvailability(item.id, v)}
                      aria-label="Toggle availability"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditItem(item)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteItem(item)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
              {group.items.length === 0 && (
                <p className="text-sm text-muted-foreground">No items in this category yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cat-name">Category name</Label>
            <Input
              id="cat-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Starters"
              className="h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit item" : "Add menu item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-price">Price (₹ INR)</Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={itemForm.price}
                onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={itemForm.category_id}
                onValueChange={(v) => setItemForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveItem} disabled={saving}>
              {editingItem ? "Update" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteItem?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the item from your menu. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
