import { ContentPage, InlineLink } from "@/components/content-page";
import { CONTACT_EMAIL } from "@/lib/config";
import { contentMetadata } from "@/lib/content-metadata";

const title = "اتصل بنا";
const description =
  "طرق التواصل مع فريق موقع جدول للاستفسارات، تصحيح بيانات المباريات، طلبات الخصوصية، حقوق الملكية، والشراكات.";

export const metadata = contentMetadata({ title, description, path: "/contact" });

export default function ContactPage() {
  const emailLink = (
    <a dir="ltr" href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent hover:underline">
      {CONTACT_EMAIL}
    </a>
  );

  return (
    <ContentPage
      title={title}
      description={description}
      path="/contact"
      schemaType="ContactPage"
      sections={[
        {
          id: "email",
          title: "البريد الإلكتروني",
          paragraphs: [
            <>يمكنك مراسلتنا على: {emailLink}.</>,
            "نقرأ الرسائل المتعلقة بالموقع والبيانات والخصوصية وحقوق الملكية. نهدف إلى الرد خلال خمسة أيام عمل، وقد يستغرق التحقق من نتيجة أو مسابقة وقتاً إضافياً إذا كان المصدر نفسه قيد المراجعة.",
          ],
        },
        {
          id: "correction",
          title: "الإبلاغ عن خطأ رياضي",
          paragraphs: [
            "لمساعدتنا على المراجعة بسرعة، اذكر اسم المسابقة، الفريقين، تاريخ المباراة، المعلومة التي تراها غير صحيحة، ورابط الصفحة إن أمكن. لا نعدل نتيجة اعتماداً على رسالة واحدة؛ نقارن البلاغ بمصدر البيانات أو الجهة المنظمة أولاً.",
          ],
        },
        {
          id: "privacy",
          title: "طلبات الخصوصية",
          paragraphs: [
            <>
              اكتب «طلب خصوصية» في عنوان الرسالة واشرح طلبك. لا توجد حسابات
              مستخدمين في جدول حالياً، لكن يمكن التواصل بشأن بيانات القياس أو
              الاختيارات المحفوظة. راجع أيضاً{" "}
              <InlineLink href="/privacy">سياسة الخصوصية</InlineLink>.
            </>,
          ],
        },
        {
          id: "rights",
          title: "حقوق الملكية والشعارات",
          paragraphs: [
            "إذا كنت تمثل صاحب حق وتعتقد أن مادة أو شعاراً عُرض بطريقة غير مناسبة، أرسل وصف العمل أو العلامة، رابط الصفحة، ما يثبت صفتك، ووسيلة تواصل واضحة. سنراجع الطلب ونتخذ الإجراء المناسب عند ثبوت الحق.",
          ],
        },
        {
          id: "business",
          title: "الشراكات والإعلان",
          paragraphs: [
            "نقبل الرسائل المتعلقة بمصادر البيانات، الاستضافة، الإعلانات، أو التعاون التحريري. لا نقبل عروض بيع الروابط أو نشر محتوى مضلل أو الترويج للمراهنات غير المرخصة. أي محتوى تجاري مقبول يجب أن يُعرّف بوضوح على أنه إعلان أو رعاية.",
          ],
        },
      ]}
    />
  );
}
