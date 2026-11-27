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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

internal val FitnessColors = darkColorScheme(
    primary = Color(0xFFB8F575),
    onPrimary = Color(0xFF172109),
    background = Color(0xFF101410),
    surface = Color(0xFF192019),
    surfaceVariant = Color(0xFF232D22),
    onSurface = Color(0xFFF1F5EA),
    onSurfaceVariant = Color(0xFFC0CCBA),
    outline = Color(0xFF667560),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF492421),
    onErrorContainer = Color(0xFFFFDAD5),
)

@Composable
internal fun FitnessHero() {
    val shape = RoundedCornerShape(28.dp)
    val accent = MaterialTheme.colorScheme.primary
    Box(
        Modifier.fillMaxWidth().clip(shape).background(
            Brush.linearGradient(listOf(Color(0xFF283D25), Color(0xFF19291C))),
        ),
    ) {
        Canvas(Modifier.align(Alignment.TopEnd).size(118.dp)) {
            val center = Offset(size.width * .63f, size.height * .44f)
            for (ring in 1..3) {
                drawCircle(accent.copy(alpha = .13f), size.width * .14f * ring, center, style = Stroke(1.dp.toPx()))
            }
            val pulse = Path().apply {
                moveTo(center.x - 33.dp.toPx(), center.y)
                lineTo(center.x - 13.dp.toPx(), center.y)
                lineTo(center.x - 5.dp.toPx(), center.y - 14.dp.toPx())
                lineTo(center.x + 4.dp.toPx(), center.y + 12.dp.toPx())
                lineTo(center.x + 12.dp.toPx(), center.y)
                lineTo(center.x + 28.dp.toPx(), center.y)
            }
            drawPath(pulse, accent, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
        }
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Fitness RPG", color = accent, style = MaterialTheme.typography.labelLarge)
            Text("Sincronize\nseus treinos", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text(
                "Leve suas atividades e métricas do Health Connect para o seu perfil no jogo.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
internal fun FitnessPanel(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}
