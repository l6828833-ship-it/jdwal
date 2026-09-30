import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.*;
import javax.imageio.ImageIO;

/**
 * Generates Android launcher assets from a single square source PNG.
 *
 * Run with:  java GenIcons.java <source.png> <res-dir> [playstore-out.png]
 *
 * Why this exists instead of a one-line `magick` call: this machine only has
 * `sips`, which resizes but cannot composite onto a padded canvas. The JDK
 * bundled with Android Studio can, so the build environment stays dependency-free.
 */
public final class GenIcons {

    /** Launcher icon sizes in px, keyed by density bucket (48dp base). */
    private static final Object[][] LEGACY = {
        {"mipmap-mdpi",     48},
        {"mipmap-hdpi",     72},
        {"mipmap-xhdpi",    96},
        {"mipmap-xxhdpi",  144},
        {"mipmap-xxxhdpi", 192},
    };

    /** Adaptive icon layer sizes in px (108dp base). */
    private static final Object[][] ADAPTIVE = {
        {"mipmap-mdpi",    108},
        {"mipmap-hdpi",    162},
        {"mipmap-xhdpi",   216},
        {"mipmap-xxhdpi",  324},
        {"mipmap-xxxhdpi", 432},
    };

    /**
     * Fraction of the 108dp adaptive canvas the artwork is allowed to occupy.
     * The mask is only guaranteed to reveal the inner 66dp, and launchers render
     * a 72dp viewport, so 0.62 keeps the ball clear of every mask shape.
     */
    private static final double ADAPTIVE_SCALE = 0.62;

    /** Legacy icons are drawn unmasked, so they can carry more of the frame. */
    private static final double LEGACY_SCALE = 0.80;
    private static final double ROUND_SCALE = 0.70;

    /** Per-channel distance from the background colour before a pixel counts as artwork. */
    private static final int BG_TOLERANCE = 40;

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: GenIcons <source.png> <res-dir> [playstore-out.png]");
            System.exit(2);
        }
        BufferedImage src = ImageIO.read(new File(args[0]));
        Path res = Paths.get(args[1]);

        int bg = src.getRGB(2, 2) | 0xFF000000;
        Rectangle art = artworkBounds(src, bg);
        System.out.printf("source %dx%d  bg #%06X  artwork %d,%d %dx%d%n",
            src.getWidth(), src.getHeight(), bg & 0xFFFFFF, art.x, art.y, art.width, art.height);

        BufferedImage crop = src.getSubimage(art.x, art.y, art.width, art.height);

        for (Object[] d : LEGACY) {
            int px = (int) d[1];
            write(square(crop, px, LEGACY_SCALE, bg), res, (String) d[0], "ic_launcher.png");
            write(round(crop, px, ROUND_SCALE, bg), res, (String) d[0], "ic_launcher_round.png");
        }
        for (Object[] d : ADAPTIVE) {
            int px = (int) d[1];
            write(square(crop, px, ADAPTIVE_SCALE, bg), res, (String) d[0], "ic_launcher_foreground.png");
            write(monochrome(crop, px, ADAPTIVE_SCALE, bg), res, (String) d[0], "ic_launcher_monochrome.png");
        }
        if (args.length > 2) {
            BufferedImage store = square(crop, 512, LEGACY_SCALE, bg);
            ImageIO.write(store, "png", new File(args[2]));
            System.out.println("wrote " + args[2] + " (512x512 Play Store icon)");
        }
    }

    /** Tightest rectangle containing every pixel that differs from the flat background. */
    private static Rectangle artworkBounds(BufferedImage img, int bg) {
        int bgR = (bg >> 16) & 0xFF, bgG = (bg >> 8) & 0xFF, bgB = bg & 0xFF;
        int minX = img.getWidth(), minY = img.getHeight(), maxX = -1, maxY = -1;
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                int p = img.getRGB(x, y);
                if (((p >>> 24) & 0xFF) < 16) continue; // already transparent
                int dr = Math.abs(((p >> 16) & 0xFF) - bgR);
                int dg = Math.abs(((p >> 8) & 0xFF) - bgG);
                int db = Math.abs((p & 0xFF) - bgB);
                if (Math.max(dr, Math.max(dg, db)) <= BG_TOLERANCE) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < 0) return new Rectangle(0, 0, img.getWidth(), img.getHeight());
        // Square it off around the centre so nothing is distorted when scaled.
        int cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        int half = Math.max(maxX - minX, maxY - minY) / 2 + 1;
        int x0 = Math.max(0, cx - half), y0 = Math.max(0, cy - half);
        int x1 = Math.min(img.getWidth(), cx + half), y1 = Math.min(img.getHeight(), cy + half);
        return new Rectangle(x0, y0, x1 - x0, y1 - y0);
    }

    /** Opaque square canvas of {@code bg} with the artwork centred at {@code scale}. */
    private static BufferedImage square(BufferedImage art, int size, double scale, int bg) {
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out);
        g.setColor(new Color(bg, true));
        g.fillRect(0, 0, size, size);
        drawCentred(g, art, size, scale);
        g.dispose();
        return out;
    }

    /** Antialiased circle of {@code bg}, transparent outside, artwork centred. */
    private static BufferedImage round(BufferedImage art, int size, double scale, int bg) {
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out);
        g.setColor(new Color(bg, true));
        g.fillOval(0, 0, size, size);
        g.setClip(new java.awt.geom.Ellipse2D.Float(0, 0, size, size));
        drawCentred(g, art, size, scale);
        g.dispose();
        return out;
    }

    /**
     * Themed-icon layer: alpha tracks luminance so the black frame drops out and
     * the ball becomes the silhouette. Colour is flattened to black because the
     * system tints this layer itself.
     */
    private static BufferedImage monochrome(BufferedImage art, int size, double scale, int bg) {
        BufferedImage flat = square(art, size, scale, bg);
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                int p = flat.getRGB(x, y);
                int r = (p >> 16) & 0xFF, gg = (p >> 8) & 0xFF, b = p & 0xFF;
                int lum = (int) (0.2126 * r + 0.7152 * gg + 0.0722 * b);
                out.setRGB(x, y, (lum << 24));
            }
        }
        return out;
    }

    private static void drawCentred(Graphics2D g, BufferedImage art, int size, double scale) {
        int target = (int) Math.round(size * scale);
        double k = Math.min((double) target / art.getWidth(), (double) target / art.getHeight());
        int w = (int) Math.round(art.getWidth() * k);
        int h = (int) Math.round(art.getHeight() * k);
        g.drawImage(art, (size - w) / 2, (size - h) / 2, w, h, null);
    }

    private static Graphics2D quality(BufferedImage img) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        return g;
    }

    private static void write(BufferedImage img, Path res, String dir, String name) throws Exception {
        Path target = res.resolve(dir);
        Files.createDirectories(target);
        ImageIO.write(img, "png", target.resolve(name).toFile());
        System.out.println("wrote " + res.getFileName() + "/" + dir + "/" + name + " (" + img.getWidth() + "px)");
    }
}
