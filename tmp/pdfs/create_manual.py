from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

styles = getSampleStyleSheet()
body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9, leading=13, textColor=colors.HexColor("#334155"))
title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#2459A5"), spaceAfter=12)
heading = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor("#112642"), spaceBefore=10, spaceAfter=6)
note = ParagraphStyle("Note", parent=body, backColor=colors.HexColor("#FFF4DC"), borderColor=colors.HexColor("#E0A331"), borderWidth=1, borderPadding=8)

def table(rows, widths, header="#2459A5"):
    return Table(rows, colWidths=widths, style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), .5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))

story = [
    Paragraph("GX | GARANTIAS CENTRAL", ParagraphStyle("Brand", parent=body, fontSize=8, textColor=colors.HexColor("#2459A5"))),
    Paragraph("Manual de pruebas para bateria automotriz", title),
    Paragraph("Documento demostrativo para el flujo de diagnostico de Garantia Express", body), Spacer(1, 12),
    Paragraph("1. Seguridad y preparacion", heading),
    Paragraph("Utiliza lentes, guantes y herramienta aislada. Trabaja en un area ventilada, sin flamas ni chispas. Verifica que la carcasa no tenga fugas, deformaciones o terminales flojas antes de conectar el equipo.", note),
    Paragraph("2. Inspeccion visual", heading),
    Paragraph("Registra marca, modelo, codigo, fecha de fabricacion y evidencia fotografica. Revisa golpes, manipulacion, sulfatacion, terminales fundidas, nivel de electrolito cuando aplique y signos de instalacion incorrecta.", body),
    Paragraph("3. Medicion de voltaje en reposo", heading),
    Paragraph("Deja la bateria sin carga durante al menos 10 minutos. Conecta el multimetro respetando polaridad y registra el voltaje.", body),
    table([["Voltaje", "Interpretacion"], ["12.60 V o mayor", "Carga completa"], ["12.40 a 12.59 V", "Carga parcial; recargar antes de evaluar"], ["12.20 a 12.39 V", "Carga baja; realizar carga controlada"], ["Menor a 12.20 V", "Descarga profunda o posible falla"]], [150, 330]),
    PageBreak(), Paragraph("4. Prueba de conductancia / CCA", heading),
    Paragraph("Configura en el probador el estandar indicado en la etiqueta y el valor CCA nominal. Limpia las terminales, conecta el equipo y registra CCA medido, resistencia interna y resultado del instrumento.", body),
    Paragraph("5. Prueba bajo carga", heading),
    Paragraph("Aplica la carga recomendada por el fabricante durante 15 segundos. Como referencia demostrativa, el voltaje no debe caer por debajo de 9.6 V a 21 C. Ajusta el criterio conforme a temperatura y especificacion del fabricante.", body),
    Paragraph("6. Criterios de dictamen", heading),
    table([["Resultado", "Criterio"], ["Procede", "Sin dano atribuible al usuario; CCA insuficiente o caida de voltaje fuera de rango despues de carga controlada."], ["No procede", "Golpe, manipulacion, instalacion incorrecta, sobrecarga, terminal fundida, fuga o codigo fuera de cobertura."], ["Requiere repeticion", "Carga insuficiente, equipo sin calibracion o lectura inestable."]], [110, 370], "#112642"),
    Paragraph("7. Evidencia obligatoria", heading),
    Paragraph("Adjunta fotografias de etiqueta, terminales, carcasa y lectura del equipo. Registra numero de serie del probador, fecha, hora, ejecutivo y observaciones. Conserva la trazabilidad del producto durante todo el proceso.", body), Spacer(1, 18),
    Paragraph("Nota: Este manual es una simulacion funcional. Los valores definitivos, equipos autorizados y tolerancias deben parametrizarse y aprobarse por Calidad y Garantias.", note),
]

SimpleDocTemplate("public/manual-pruebas-bateria.pdf", pagesize=letter, rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=42, title="Manual de pruebas - Bateria automotriz").build(story)
