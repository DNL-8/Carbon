package com.dnl8.fitnessrpg

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.time.ZoneId
import java.util.Locale

private val locale = Locale.forLanguageTag("pt-BR")
private val dayFormat = DateTimeFormatter.ofPattern("dd/MM", locale)
private val timeFormat = DateTimeFormatter.ofPattern("dd/MM 'às' HH:mm", locale)
private val number = NumberFormat.getNumberInstance(locale).apply { maximumFractionDigits = 1 }
private val activityColor = Color(0xFFFFB45D)
private val sleepColor = Color(0xFFC5B6FF)
private val heartColor = Color(0xFFFF9CAC)

private fun metric(value: Double?, unit: String): String =
    value?.let { number.format(it) + if (unit.isEmpty()) "" else " $unit" } ?: "Sem medição"

@Composable
internal fun HealthOverviewHeader() {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp))
        .background(Brush.linearGradient(listOf(Color(0xFF304829), Color(0xFF19291C))))) {
        Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("MURIM  /  SAÚDE", style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary)
            Text("Seu resumo", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("Acompanhe o que seu dispositivo registrou.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun HealthOverviewCards(
    overview: HealthOverview?, loading: Boolean, canRead: Boolean, onRefresh: () -> Unit, onConnect: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Últimos 7 dias", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        TextButton(enabled = canRead && !loading, onClick = onRefresh) {
            Text(if (loading) "Lendo…" else "Atualizar")
        }
    }
    if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
    if (overview == null) {
        FitnessPanel {
            Text(if (canRead) "Leia seus dados" else "Conecte seus dados", style = MaterialTheme.typography.titleMedium)
            Text(if (canRead) "Atualize para consultar as medições autorizadas. A leitura do resumo não envia dados ao servidor."
                 else "Escolha quais dados o Health Connect pode disponibilizar.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                enabled = !loading, onClick = if (canRead) onRefresh else onConnect) {
                Text(if (canRead) "Atualizar resumo" else "Gerenciar conexão")
            }
        }
        return
    }
    val day = overview.today
    val days = overview.days
    val primary = MaterialTheme.colorScheme.primary
    FitnessPanel {
        MetricHeading("Atividade", activityColor, "Hoje")
        Text(metric(day.exerciseMinutes, "min"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Tempo em exercício registrado", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
        Text(metric(day.calories, "kcal"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text("Energia ativa", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        HistoryBars(days.map { it.date.format(dayFormat) to it.exerciseMinutes }, "Tempo de exercício", "min", activityColor)
    }
    FitnessPanel {
        MetricHeading("Passos", primary, "Hoje")
        Text(metric(day.steps, ""), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Passos registrados", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        HistoryBars(days.map { it.date.format(dayFormat) to it.steps }, "Passos", "", primary)
    }
    FitnessPanel {
        val sleep = overview.latestSleep
        MetricHeading("Sono", sleepColor, sleep?.date?.format(dayFormat) ?: "Sem registro")
        Text(metric(sleep?.longestSleepHours, "h"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Sessão mais longa registrada no dia. Não é uma pontuação de sono.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        HistoryBars(days.map { it.date.format(dayFormat) to it.longestSleepHours }, "Sessão de sono mais longa", "h", sleepColor)
    }
    FitnessPanel {
        MetricHeading("Frequência cardíaca", heartColor, "Última leitura")
        Text(metric(overview.latestHeartRate, "bpm"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        overview.latestHeartAt?.let {
            Text(it.atZone(ZoneId.systemDefault()).format(timeFormat), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val measured = days.filter { it.heartMin != null && it.heartMax != null }
        if (measured.isEmpty()) {
            Text("Sem amostras cardíacas no período.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            val low = measured.minOf { it.heartMin!! }
            val high = measured.maxOf { it.heartMax!! }
            Text("Faixa registrada: ${metric(low, "")}–${metric(high, "bpm")}", style = MaterialTheme.typography.bodyMedium)
            HeartRanges(days, low, high)
        }
    }
    Text("Fonte: Health Connect • Dados locais dos últimos sete dias. Lacunas significam ausência de registro autorizado, não zero. Os dados são informativos.",
        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun MetricHeading(label: String, accent: Color, period: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(accent))
        Column(Modifier.weight(1f)) {
            Text(label, color = accent, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(period, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun HistoryBars(values: List<Pair<String, Double?>>, title: String, unit: String, accent: Color) {
    if (values.none { it.second != null }) {
        Text("Sem histórico no período.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        return
    }
    val max = values.mapNotNull { it.second }.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
    val description = "$title. " + values.joinToString("; ") { (date, value) -> "$date: ${metric(value, unit)}" }
    Canvas(Modifier.fillMaxWidth().height(86.dp).semantics { contentDescription = description }) {
        val slot = size.width / values.size
        values.forEachIndexed { index, (_, value) ->
            if (value != null) {
                val h = ((value / max).toFloat() * size.height).coerceAtLeast(2.dp.toPx())
                drawRoundRect(accent, Offset(slot * index + slot * .2f, size.height - h),
                    Size(slot * .6f, h), CornerRadius(5.dp.toPx()))
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(values.first().first, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(values.last().first, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun HeartRanges(days: List<HealthDay>, low: Double, high: Double) {
    val description = "Faixa cardíaca diária. " + days.joinToString("; ") {
        "${it.date.format(dayFormat)}: " + if (it.heartMin == null || it.heartMax == null) "Sem medição"
        else "${metric(it.heartMin, "")} a ${metric(it.heartMax, "bpm")}"
    }
    Canvas(Modifier.fillMaxWidth().height(105.dp).semantics { contentDescription = description }) {
        val min = low - 5
        val span = high + 5 - min
        val slot = size.width / days.size
        days.forEachIndexed { index, day ->
            val a = day.heartMin
            val b = day.heartMax
            if (a != null && b != null) {
                val x = slot * (index + .5f)
                val y1 = size.height * (1 - ((a - min) / span).toFloat())
                val y2 = size.height * (1 - ((b - min) / span).toFloat())
                drawLine(heartColor, Offset(x, y1), Offset(x, y2), strokeWidth = 9.dp.toPx(), cap = StrokeCap.Round)
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(days.first().date.format(dayFormat), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(days.last().date.format(dayFormat), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
