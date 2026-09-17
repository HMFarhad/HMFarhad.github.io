"""Build the portfolio resume. Requires reportlab."""
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/documents/Hossain_MD_Farhad_Resume.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='NameCustom', fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=HexColor('#132d39'), spaceAfter=7))
styles.add(ParagraphStyle(name='BodyCustom', fontName='Helvetica', fontSize=9.6, leading=13.8, spaceAfter=6, textColor=HexColor('#263840')))
styles.add(ParagraphStyle(name='SectionCustom', fontName='Helvetica-Bold', fontSize=10, leading=14, spaceBefore=13, spaceAfter=8, textColor=HexColor('#18736e')))
styles.add(ParagraphStyle(name='RoleCustom', fontName='Helvetica-Bold', fontSize=11, leading=15, spaceBefore=8, spaceAfter=2, textColor=HexColor('#132d39')))
styles.add(ParagraphStyle(name='MetaCustom', fontName='Helvetica', fontSize=9, leading=13, spaceAfter=6, textColor=HexColor('#52666e')))
styles.add(ParagraphStyle(name='BulletCustom', parent=styles['BodyCustom'], leftIndent=11, firstLineIndent=-8, spaceAfter=4))
story=[]
def p(text, style='BodyCustom'):
    story.append(Paragraph(text, styles[style]))
def section(title):
    p(title.upper(),'SectionCustom')
def role(title, company, period, bullets=(), intro=None):
    story.append(KeepTogether([Paragraph(title,styles['RoleCustom']),Paragraph(company+'  |  '+period,styles['MetaCustom'])]))
    if intro: p(intro)
    for b in bullets: p('• '+b,'BulletCustom')
def footer(c,doc):
    c.setStrokeColor(HexColor('#d7e2e3'));c.line(44,39,551,39)
    c.setFont('Helvetica',8);c.setFillColor(HexColor('#52666e'))
    c.drawString(44,26,'Hossain Mohammad Farhad  |  Software Engineer  |  September 2026')
    c.drawRightString(551,26,str(doc.page))
p('Hossain Mohammad Farhad','NameCustom')
p('Software Engineer at Nexetic Oy · C# / .NET · Angular','RoleCustom')
p('Helsinki, Finland  |  <link href="mailto:hssnmd.farhad@gmail.com">hssnmd.farhad@gmail.com</link><br/><link href="https://github.com/HMFarhad">GitHub</link>  /  <link href="https://www.linkedin.com/in/hmfarhad/">LinkedIn</link>  /  <link href="https://hmfarhad.github.io/">Portfolio</link>','MetaCustom')
section('Professional summary')
p('Software Engineer at Nexetic Oy since September 2026. Full stack developer experienced in C#, .NET Core, ASP.NET, Angular and MSSQL, delivering applications across SaaS, inventory management, e-commerce and fintech. Track record of reducing latency, improving transaction workflows and collaborating in multicultural teams.')
section('Core skills')
p('<b>Backend:</b> C#, ASP.NET, .NET Core, Web API, EF Core, RESTful APIs<br/><b>Frontend:</b> Angular, TypeScript, JavaScript<br/><b>Data &amp; cloud:</b> MSSQL, Oracle 11g, Azure Functions<br/><b>Engineering:</b> Unit &amp; integration testing, Clean Architecture, n-tier, MVC, OOP<br/><b>Tools:</b> Git, GitHub Actions, OpenAPI / NSwag, JIRA, HanSoft, Agile / Scrum, AI-assisted development<br/><b>Communication:</b> Stakeholder collaboration, code reviews, technical documentation')
section('Professional experience')
role('Software Engineer','Nexetic Oy','September 2026 - Present',[
    'Contributed full-stack production features to a Microsoft 365 backup SaaS platform using C#, .NET, Angular, EF Core, Azure Functions and SQL.',
    'Implemented Microsoft LAPS backup functionality with encryption, tenant isolation, audit logging and automated tests.',
    'Built reporting and data-processing tools for licensing, customer attribution, backup health and migration verification.',
    'Contributed to OpenAPI / NSwag contracts, code reviews, technical documentation and development-process improvements.',
    'Used AI-assisted tools for planning, coding, testing and debugging while validating security and correctness.'
])
role('Software Engineer (Freelance)','AdvancePro Technologies','January 2023 - September 2025',[
    'Reduced API response times by 30% through performance analysis and a dedicated search API returning only essential data.',
    'Integrated Authorize.net payment workflows and automated invoices for 200+ active business clients.',
    'Developed RESTful APIs to synchronize inventory, e-commerce and accounting across platforms including Shopify and Avalara.',
    'Led code reviews and refactored legacy modules to improve maintainability and reduce bugs.'
])
story.append(PageBreak())
section('Professional experience / continued')
role('.NET Programmer','MobilityOne Sdn Bhd','December 2022 - August 2024',[
    'Built and maintained .NET Core APIs with MSSQL and Oracle for a public-facing municipal eBilling system enabling continuous utility-bill payments.',
    'Developed automated settlement using Hangfire for 200-300 daily transactions, reducing pending settlements by 90% and achieving over 85% completion within 24 hours.',
    'Collaborated with a four-member backend team on fintech modules and reliable transaction processing across regional payment gateways using microservices patterns.'
])
role('Software Engineer','Prime Tech Solution Limited','March 2018 - December 2022',[
    'Implemented real-time SignalR updates for Banglalink DMS, supporting supply-chain transparency for 4,500 distributors and 200,000 retailers.',
    'Delivered an ASP.NET MVC system for IRIDP-2, enabling nationwide infrastructure tracking with role-based dashboards and performance analytics.',
    'Built modular .NET Core and Angular e-commerce APIs for AARMOIRE, covering inventory, loyalty and reporting with GitHub Actions CI/CD.'
])
section('Education')
role('Master of Engineering - Cloud-based Software Engineering','Vaasa University of Applied Science (VAMK)','2025')
role('Bachelor of Science - Computer Science and Engineering','American International University Bangladesh (AIUB)','2018')
section('Languages')
p('<b>Bengali:</b> Native  |  <b>English:</b> Advanced (TOEFL 96/120)  |  <b>Finnish:</b> Actively learning')

SimpleDocTemplate(str(OUTPUT),pagesize=(595.28,841.89),rightMargin=44,leftMargin=44,topMargin=40,bottomMargin=52,title='Hossain Mohammad Farhad - Software Engineer',author='Hossain Mohammad Farhad').build(story,onFirstPage=footer,onLaterPages=footer)
print(OUTPUT)
