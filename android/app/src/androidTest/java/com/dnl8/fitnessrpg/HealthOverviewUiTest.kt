package com.dnl8.fitnessrpg

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HealthOverviewUiTest {
    @get:Rule val compose = createComposeRule()

    private val today = LocalDate.parse("2026-11-27")

    private fun screenshot(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val bitmap = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        try {
            // AGP collects additional test output before removing the test APKs.
            val configured = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir")
            val directory = if (configured.isNullOrBlank()) {
                checkNotNull(instrumentation.targetContext.getExternalFilesDir("ui-captures"))
            } else File(configured)
            check(directory.isDirectory || directory.mkdirs())
            File(directory, "$name.png").outputStream().use {
                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
            }
        } finally {
            bitmap.recycle()
        }
    }

    @Test fun summaryWithSyntheticMeasurements() {
        val days = (0L..6L).map { offset ->
            HealthDay(today.minusDays(6 - offset),
                steps = if (offset == 2L) null else 4200.0 + offset * 700,
                calories = 120.0 + offset * 25,
                exerciseMinutes = if (offset == 2L) null else 20.0 + offset * 5,
                longestSleepHours = 7.5,
                heartMin = 60.0 + offset, heartMax = 110.0 + offset)
        }
        val overview = HealthOverview(days, 72.0, Instant.parse("2026-11-27T12:00:00Z"))
        compose.setContent {
            MaterialTheme(colorScheme = FitnessColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        HealthOverviewHeader()
                        HealthOverviewCards(overview, false, true, {}, {})
                    }
                }
            }
        }
        compose.onNodeWithText("Seu resumo").assertIsDisplayed()
        compose.onNodeWithText("Tempo em exercício registrado").assertIsDisplayed()
        compose.onNodeWithText("50 min").assertIsDisplayed()
        screenshot("overview")
        compose.onNodeWithText("Passos registrados").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Sono", substring = false).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("72 bpm").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Faixa registrada:", substring = true).performScrollTo().assertIsDisplayed()
        screenshot("heart")
        compose.onNodeWithText("Humor", substring = false).assertDoesNotExist()
        compose.onNodeWithText("Ciclo menstrual", substring = false).assertDoesNotExist()
        compose.onNodeWithText("Pontuação do sono", substring = false).assertDoesNotExist()
    }

    @Test fun emptyStateAndRefreshCallback() {
        var requested = false
        val overview = buildHealthOverview(emptyList(), today, ZoneOffset.UTC,
            Instant.parse("2026-11-27T20:00:00Z"))
        compose.setContent {
            MaterialTheme(colorScheme = FitnessColors) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        HealthOverviewHeader()
                        HealthOverviewCards(overview, false, true, { requested = true }, {})
                    }
                }
            }
        }
        compose.onAllNodesWithText("Sem medição")[0].assertIsDisplayed()
        compose.onNodeWithText("Atualizar", substring = false).performClick()
        compose.runOnIdle { check(requested) }
        screenshot("empty")
    }
}
