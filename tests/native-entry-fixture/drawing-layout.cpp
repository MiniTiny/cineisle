// Controlled layout metrics, not a renderer. Real production budget checks decide admission.
// Reaching BitmapCreate throws a distinct sentinel before any pixels are allocated or painted.
#include <native_drawing/drawing_text_typography.h>
#include <native_drawing/drawing_font_collection.h>
#include <native_drawing/drawing_bitmap.h>
#include <native_drawing/drawing_point.h>
#include <fribidi/fribidi.h>
#include <cstdlib>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

struct OH_Drawing_FontCollection {};
struct OH_Drawing_TypographyStyle {};
struct OH_Drawing_TextStyle { double baseline = 0, size = 20; };
struct OH_Drawing_TypographyCreate { OH_Drawing_TextStyle current; std::vector<OH_Drawing_TextStyle> runs; };
struct OH_Drawing_Typography { std::vector<OH_Drawing_TextStyle> runs; };
struct OH_Drawing_TextBox { size_t count; float top; };
struct OH_Drawing_TextShadow {};
struct OH_Drawing_Point {};
namespace {
double Metric(const char *name, double fallback)
{
    const auto *value = std::getenv(name); return value ? std::strtod(value, nullptr) : fallback;
}
size_t Boxes(size_t index)
{
    const auto *value = std::getenv("CINEISLE_LAYOUT_BOXES");
    if (!value) { return 1; }
    std::istringstream values(value); std::string part;
    for (size_t i = 0; std::getline(values, part, ','); ++i) {
        if (i == index) { return std::stoull(part); }
    }
    throw std::runtime_error("caption_fixture_missing_box_count");
}
}
extern "C" {
OH_Drawing_FontCollection *OH_Drawing_CreateFontCollection(void) { return new OH_Drawing_FontCollection; }
void OH_Drawing_DestroyFontCollection(OH_Drawing_FontCollection *value) { delete value; }
OH_Drawing_TypographyStyle *OH_Drawing_CreateTypographyStyle(void) { return new OH_Drawing_TypographyStyle; }
void OH_Drawing_DestroyTypographyStyle(OH_Drawing_TypographyStyle *value) { delete value; }
void OH_Drawing_SetTypographyTextAlign(OH_Drawing_TypographyStyle *, int) {}
void OH_Drawing_SetTypographyTextDirection(OH_Drawing_TypographyStyle *, int) {}
void OH_Drawing_SetTypographyTextMaxLines(OH_Drawing_TypographyStyle *, int) {}
void OH_Drawing_SetTypographyTextEllipsis(OH_Drawing_TypographyStyle *, const char *) {}
OH_Drawing_TypographyCreate *OH_Drawing_CreateTypographyHandler(OH_Drawing_TypographyStyle *, OH_Drawing_FontCollection *) { return new OH_Drawing_TypographyCreate; }
void OH_Drawing_DestroyTypographyHandler(OH_Drawing_TypographyCreate *value) { delete value; }
OH_Drawing_TextStyle *OH_Drawing_CreateTextStyle(void) { return new OH_Drawing_TextStyle; }
void OH_Drawing_DestroyTextStyle(OH_Drawing_TextStyle *value) { delete value; }
void OH_Drawing_SetTextStyleFontFamilies(OH_Drawing_TextStyle *, int, const char *[]) {}
void OH_Drawing_SetTextStyleFontSize(OH_Drawing_TextStyle *value, double size) { value->size = size; }
void OH_Drawing_SetTextStyleFontWeight(OH_Drawing_TextStyle *, int) {}
void OH_Drawing_SetTextStyleFontStyle(OH_Drawing_TextStyle *, int) {}
void OH_Drawing_SetTextStyleColor(OH_Drawing_TextStyle *, uint32_t) {}
void OH_Drawing_TextStyleSetBaselineShift(OH_Drawing_TextStyle *value, double baseline) { value->baseline = baseline; }
void OH_Drawing_SetTextStyleDecoration(OH_Drawing_TextStyle *, int) {}
void OH_Drawing_SetTextStyleDecorationColor(OH_Drawing_TextStyle *, uint32_t) {}
void OH_Drawing_TypographyHandlerPushTextStyle(OH_Drawing_TypographyCreate *value, OH_Drawing_TextStyle *style) { value->current = *style; }
void OH_Drawing_TypographyHandlerAddText(OH_Drawing_TypographyCreate *value, const char *) { value->runs.push_back(value->current); }
void OH_Drawing_TypographyHandlerPopTextStyle(OH_Drawing_TypographyCreate *) {}
OH_Drawing_Typography *OH_Drawing_CreateTypography(OH_Drawing_TypographyCreate *value) { return new OH_Drawing_Typography{value->runs}; }
void OH_Drawing_DestroyTypography(OH_Drawing_Typography *value) { delete value; }
void OH_Drawing_TypographyLayout(OH_Drawing_Typography *, double) {}
double OH_Drawing_TypographyGetHeight(OH_Drawing_Typography *) { return Metric("CINEISLE_LAYOUT_HEIGHT", 20); }
double OH_Drawing_TypographyGetLongestLine(OH_Drawing_Typography *) { return Metric("CINEISLE_LAYOUT_LONGEST", 100); }
bool OH_Drawing_TypographyDidExceedMaxLines(OH_Drawing_Typography *) { return false; }
OH_Drawing_TextBox *OH_Drawing_TypographyGetRectsForRange(OH_Drawing_Typography *value, size_t start, size_t,
    OH_Drawing_RectHeightStyle, OH_Drawing_RectWidthStyle)
{
    // Let the actual Orientation() calibration observe its requested 37 px baseline displacement.
    const bool calibration = value->runs.size() == 2 && value->runs[0].size == 70 && value->runs[0].baseline == 37;
    return new OH_Drawing_TextBox{calibration ? 1 : Boxes(start), float(value->runs.at(start).baseline)};
}
void OH_Drawing_TypographyDestroyTextBox(OH_Drawing_TextBox *value) { delete value; }
size_t OH_Drawing_GetSizeOfTextBox(OH_Drawing_TextBox *value) { return value->count; }
float OH_Drawing_GetLeftFromTextBox(OH_Drawing_TextBox *, int) { return 0; }
float OH_Drawing_GetRightFromTextBox(OH_Drawing_TextBox *, int) { return 1; }
float OH_Drawing_GetTopFromTextBox(OH_Drawing_TextBox *value, int) { return value->top; }
float OH_Drawing_GetBottomFromTextBox(OH_Drawing_TextBox *, int) { return 10; }
bool OH_Drawing_TypographyGetLineMetricsAt(OH_Drawing_Typography *, int, OH_Drawing_LineMetrics *value)
{
    *value = {}; value->firstCharMetrics.descent = 2; value->firstCharMetrics.underlinePosition = 1;
    value->firstCharMetrics.underlineThickness = 1; return true;
}
OH_Drawing_TextShadow *OH_Drawing_CreateTextShadow(void) { return new OH_Drawing_TextShadow; }
void OH_Drawing_DestroyTextShadow(OH_Drawing_TextShadow *value) { delete value; }
OH_Drawing_Point *OH_Drawing_PointCreate(float, float) { return new OH_Drawing_Point; }
void OH_Drawing_PointDestroy(OH_Drawing_Point *value) { delete value; }
void OH_Drawing_SetTextShadow(OH_Drawing_TextShadow *, uint32_t, OH_Drawing_Point *, double) {}
void OH_Drawing_TextStyleAddShadow(OH_Drawing_TextStyle *, const OH_Drawing_TextShadow *) {}
OH_Drawing_Bitmap *OH_Drawing_BitmapCreate(void) { throw std::runtime_error("caption_fixture_budget_admitted"); }
FriBidiStrIndex fribidi_charset_to_unicode(FriBidiCharSet, const char *, FriBidiStrIndex, FriBidiChar *) { return 0; }
void fribidi_get_bidi_types(const FriBidiChar *, FriBidiStrIndex, FriBidiCharType *) {}
FriBidiParType fribidi_get_par_direction(const FriBidiCharType *, FriBidiStrIndex) { return FRIBIDI_PAR_LTR; }
}
