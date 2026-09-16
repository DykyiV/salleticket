import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <SectionPlaceholder
      title="Звіти"
      description="Розрахунки з перевізниками, агентами і каса — усі звіти в одному місці."
      features={[
        {
          text: "Розрахунки з перевізниками: щомісячні звіти з рахунком і актом, сальдо за точкою оплати, автогенерація 7-го числа, історія (сформовано/надіслано/оплачено).",
          done: true,
          href: "/admin/settlements",
        },
        {
          text: "9.1 Звіт агента: його пасажири, оборот і його % винагороди.",
        },
        {
          text: "9.2 Звіт для перевізника: усі пасажири перевізника з усього сайту; галочка «розбити по агентах» — хто на яку суму бронював і яка його комісія (частково є у settlements).",
        },
        {
          text: "9.3 Звіт для каси: усі пасажири, яким даний користувач зарахував кошти.",
        },
      ]}
    />
  );
}
