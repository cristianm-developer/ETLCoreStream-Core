import type { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import type { RowObject } from "@/shared/schemes/row-object";

export const AsyncTransformDataExample = (): GlobalStepTransform => ({
  name: "AsyncTransformDataExample",
  fn: async (rows: RowObject[], ..._args: any[]) => {
    const itemsExtracted = rows.map((row) => ({ id: row.__rowId, value: row.value["headerKey"] }));
    const transformedItems = await transformDataExample(itemsExtracted);
    const rowMap = new Map(rows.map((r) => [r.__rowId, r]));

    transformedItems.forEach((item) => {
      const row = rowMap.get(item.id);
      if (row) {
        row.value["headerKey"] = item.value;
      }
    });
  },
});

const transformDataExample = async (
  items: { id: number; value: string }[]
): Promise<{ id: number; value: string }[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      items.forEach((item) => {
        if (item.value?.startsWith("A")) {
          item.value = item.value?.toUpperCase();
        } else {
          item.value = item.value?.toLowerCase();
        }
      });
      resolve(items);
    }, 1000);
  });
};
