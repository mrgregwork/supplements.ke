import { TrendingUp, TrendingDown, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeoScoreBadge } from "@/components/seo-score-badge";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const rankingTrend = product.keywordRanking <= 10 ? "up" : "down";

  return (
    <Card className="group overflow-visible hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-product-${product.id}`}>
      <div className="relative aspect-square overflow-hidden rounded-t-md bg-muted/30">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2">
          <SeoScoreBadge score={product.seoScore} size="sm" />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-2">
          <Badge variant="secondary" className="text-xs mb-2" data-testid={`badge-category-${product.id}`}>
            {product.category}
          </Badge>
          <h3 className="font-semibold text-base line-clamp-2 leading-snug" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-foreground" data-testid={`text-price-${product.id}`}>
            ${product.price.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">{product.searchVolume.toLocaleString()}/mo</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {rankingTrend === "up" ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-xs">Rank #{product.keywordRanking}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-mono truncate" data-testid={`text-keyword-${product.id}`}>
            {product.primaryKeyword}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
