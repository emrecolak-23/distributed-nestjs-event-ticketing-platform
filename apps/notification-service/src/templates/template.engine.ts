import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { EmailTemplate } from './interfaces';

@Injectable()
export class TemplateEngine {
  private readonly templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.registerTemplates();
  }

  private registerTemplates() {
    // Booking refunded

    this.templates.set('booking_refunded', {
      subject: 'İade onaylandı — {{bookingNumber}}',
      body: `Merhaba,
      
      Booking {{bookingNumber}} için iade talebiniz onaylandı. {{totalAmount}} {{currency}} tutarı kartınıza 3-5 iş günü içinde geri yansıyacak.
      
      Teşekkür ederiz.`,
      html: `<h2>İade onaylandı</h2>
      <p>Booking <strong>{{bookingNumber}}</strong> için iade talebiniz onaylandı.</p>
      <p><strong>{{totalAmount}} {{currency}}</strong> tutarı kartınıza 3-5 iş günü içinde geri yansıyacak.</p>`,
    });
    // Booking confirmed
    this.templates.set('booking_confirmed', {
      subject: 'Booking onaylandı — {{bookingNumber}}',
      body: `Merhaba {{attendeeName}},

Ödemeniz başarıyla alındı. Booking detayları:

Booking No: {{bookingNumber}}
Etkinlik: {{eventTitle}}
Toplam: {{totalAmount}} {{currency}}

Koltuklarınız:
{{#each seats}}
- {{sectionName}} / Sıra {{row}} / Koltuk {{seatNumber}}
{{/each}}

İyi eğlenceler!`,
      html: `<h2>Booking onaylandı</h2>
<p>Merhaba <strong>{{attendeeName}}</strong>,</p>
<p>Ödemeniz başarıyla alındı.</p>
<table style="border-collapse:collapse">
  <tr><td><strong>Booking No:</strong></td><td>{{bookingNumber}}</td></tr>
  <tr><td><strong>Etkinlik:</strong></td><td>{{eventTitle}}</td></tr>
  <tr><td><strong>Toplam:</strong></td><td>{{totalAmount}} {{currency}}</td></tr>
</table>
<h3>Koltuklarınız</h3>
<ul>
{{#each seats}}
  <li>{{sectionName}} / Sıra {{row}} / Koltuk {{seatNumber}}</li>
{{/each}}
</ul>
<p>İyi eğlenceler!</p>`,
    });

    // Payment failed
    this.templates.set('payment_failed', {
      subject: 'Ödemeniz başarısız oldu — {{bookingNumber}}',
      body: `Merhaba,

Booking {{bookingNumber}} için ödemeniz başarısız oldu.
Sebep: {{reason}}

Koltuklarınız serbest bırakıldı. Tekrar denemek isterseniz yeni bir rezervasyon yapabilirsiniz.`,
      html: `<h2>Ödemeniz başarısız oldu</h2>
<p>Booking <strong>{{bookingNumber}}</strong> için ödemeniz başarısız oldu.</p>
<p><strong>Sebep:</strong> {{reason}}</p>
<p>Koltuklarınız serbest bırakıldı.</p>`,
    });

    // Seat hold expired
    this.templates.set('hold_expired', {
      subject: 'Koltuk rezervasyonunuz sona erdi',
      body: `Merhaba,

{{eventTitle}} etkinliği için seçtiğiniz koltuklar için süre doldu. Koltuklar tekrar müsait durumda.

Rezervasyonunuza devam etmek için yeni bir seçim yapmanız gerekiyor.`,
      html: `<h2>Rezervasyon süresi doldu</h2>
<p><strong>{{eventTitle}}</strong> etkinliği için koltuk rezervasyonunuzun süresi doldu.</p>
<p>Rezervasyonunuza devam etmek için yeni bir seçim yapmanız gerekiyor.</p>`,
    });
  }

  render(templateId: string, data: Record<string, any>): EmailTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const subjectCompiled = Handlebars.compile(template.subject);
    const bodyCompiled = Handlebars.compile(template.body);
    const htmlCompiled = Handlebars.compile(template.html);

    return {
      subject: subjectCompiled(data),
      body: bodyCompiled(data),
      html: htmlCompiled(data),
    };
  }
}
