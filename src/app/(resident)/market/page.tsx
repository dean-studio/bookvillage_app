"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Package, Loader2, ImagePlus } from "lucide-react";
import {
  getMarketItems,
  createMarketItem,
  updateMarketItemStatus,
} from "@/app/actions/market";
import { uploadMarketImage } from "@/lib/storage";

type ApiStatus = "on_sale" | "reserved" | "sold";
type FilterStatus = ApiStatus | "all";

const STATUS_LABEL: Record<ApiStatus, string> = {
  on_sale: "판매중",
  reserved: "예약중",
  sold: "판매완료",
};

const STATUS_VARIANT: Record<ApiStatus, "default" | "secondary" | "outline"> = {
  on_sale: "default",
  reserved: "secondary",
  sold: "outline",
};

type MarketItemWithProfile = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  images: unknown;
  status: ApiStatus;
  created_at: string;
  updated_at: string;
  profiles: { name: string; dong_ho: string } | null;
};

export default function MarketPage() {
  const [items, setItems] = useState<MarketItemWithProfile[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedItem, setSelectedItem] = useState<MarketItemWithProfile | null>(null);
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // 글쓰기 폼 상태
  const [formTitle, setFormTitle] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    setIsLoading(true);
    const result = await getMarketItems({
      status: filter === "all" ? undefined : filter,
    });
    setItems(result.items as MarketItemWithProfile[]);
    setIsLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, [filter]);

  const filteredItems = search
    ? items.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  function formatPrice(price: number) {
    return price.toLocaleString("ko-KR") + "원";
  }

  function getImages(images: unknown): string[] {
    if (Array.isArray(images)) return images.filter((i) => typeof i === "string");
    return [];
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadMarketImage(file);
      if (url) urls.push(url);
    }
    setFormImages((prev) => [...prev, ...urls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    if (!formTitle || !formPrice || !formDesc) {
      setFormError("모든 항목을 입력해주세요.");
      return;
    }

    setFormError(null);
    const formData = new FormData();
    formData.set("title", formTitle);
    formData.set("price", formPrice);
    formData.set("description", formDesc);
    formImages.forEach((url) => formData.append("images", url));

    startTransition(async () => {
      const result = await createMarketItem(formData);
      if (result.success) {
        setShowWriteForm(false);
        setFormTitle("");
        setFormPrice("");
        setFormDesc("");
        setFormImages([]);
        loadItems();
      } else {
        setFormError(result.error ?? "등록에 실패했습니다.");
      }
    });
  }

  function handleStatusChange(itemId: string, newStatus: ApiStatus) {
    startTransition(async () => {
      const result = await updateMarketItemStatus(itemId, newStatus);
      if (result.success) {
        setSelectedItem(null);
        loadItems();
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">중고장터</h1>
          <Button size="sm" onClick={() => setShowWriteForm(true)}>
            <Plus className="size-4" />
            글쓰기
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="물품명으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 mt-2">
          {(["all", "on_sale", "reserved", "sold"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "전체" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {search ? "검색 결과가 없습니다" : "등록된 중고 물품이 없습니다"}
          </p>
        ) : (
          filteredItems.map((item) => {
            const imgs = getImages(item.images);
            return (
              <Card
                key={item.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="flex gap-3 p-3">
                  <div className="w-24 h-24 bg-muted rounded shrink-0 flex items-center justify-center overflow-hidden">
                    {imgs.length > 0 ? (
                      <img
                        src={imgs[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="size-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.profiles?.dong_ho ?? ""}
                    </p>
                    <p className="font-bold mt-auto">
                      {formatPrice(item.price)}
                    </p>
                    <Badge
                      variant={STATUS_VARIANT[item.status]}
                      className="w-fit"
                    >
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* 물품 상세 모달 */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        {selectedItem && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedItem.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {(() => {
                const imgs = getImages(selectedItem.images);
                return imgs.length > 0 ? (
                  <div className="w-full h-48 rounded overflow-hidden">
                    <img
                      src={imgs[0]}
                      alt={selectedItem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
                    <Package className="size-16 text-muted-foreground" />
                  </div>
                );
              })()}
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">
                  {formatPrice(selectedItem.price)}
                </p>
                <Badge variant={STATUS_VARIANT[selectedItem.status]}>
                  {STATUS_LABEL[selectedItem.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedItem.description}
              </p>
              <div className="text-sm text-muted-foreground border-t pt-3">
                <p>
                  판매자: {selectedItem.profiles?.name ?? "알 수 없음"} ({selectedItem.profiles?.dong_ho ?? ""})
                </p>
                <p>등록일: {new Date(selectedItem.created_at).toLocaleDateString("ko-KR")}</p>
              </div>
              {/* 상태 변경 버튼 */}
              {selectedItem.status === "on_sale" && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedItem.id, "reserved")}
                    disabled={isPending}
                  >
                    예약중으로 변경
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedItem.id, "sold")}
                    disabled={isPending}
                  >
                    판매완료
                  </Button>
                </div>
              )}
              {selectedItem.status === "reserved" && (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedItem.id, "on_sale")}
                    disabled={isPending}
                  >
                    판매중으로 변경
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedItem.id, "sold")}
                    disabled={isPending}
                  >
                    판매완료
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* 글쓰기 모달 */}
      <Dialog open={showWriteForm} onOpenChange={setShowWriteForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>물품 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">제목</label>
              <Input
                placeholder="물품 제목을 입력하세요"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">가격</label>
              <Input
                placeholder="가격 (원)"
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">설명</label>
              <textarea
                placeholder="물품 설명을 입력하세요"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">사진</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              {formImages.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {formImages.map((url, i) => (
                    <div key={i} className="w-20 h-20 rounded overflow-hidden relative">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5"
                        onClick={() => setFormImages((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <span className="text-white text-xs">✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground w-full hover:border-foreground/30 transition-colors"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> 업로드 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ImagePlus className="size-4" /> 터치하여 사진 추가
                  </span>
                )}
              </button>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isPending || uploading}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> 등록 중...
                </span>
              ) : (
                "등록하기"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
