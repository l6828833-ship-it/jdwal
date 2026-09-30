import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/**
 * Renders an adaptive-icon foreground through the launcher masks, so clipping can
 * be checked without installing the app.
 *
 * A 108dp layer is cropped to a 72dp viewport by the system. Anything the circle
 * mask cuts off is what a Pixel launcher will cut off.
 *
 * Run with:  java PreviewMask.java <foreground.png> <out.png>
 */
public final class PreviewMask {
    public static void main(String[] args) throws Exception {
        BufferedImage fg = ImageIO.read(new File(args[0]));
        int n = fg.getWidth();              // 108dp in px
        double viewport = n * 72.0 / 108.0; // the 72dp the launcher shows
        double inset = (n - viewport) / 2.0;

        Shape[] masks = {
            new Ellipse2D.Double(inset, inset, viewport, viewport),
            new RoundRectangle2D.Double(inset, inset, viewport, viewport, viewport * 0.30, viewport * 0.30),
            new RoundRectangle2D.Double(inset, inset, viewport, viewport, viewport * 0.10, viewport * 0.10),
        };

        int pad = 12;
        BufferedImage out = new BufferedImage(
            (int) (masks.length * (viewport + pad) + pad), (int) (viewport + 2 * pad),
            BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(0x30, 0x30, 0x30));
        g.fillRect(0, 0, out.getWidth(), out.getHeight());

        for (int i = 0; i < masks.length; i++) {
            Graphics2D cell = (Graphics2D) g.create();
            cell.translate(pad + i * (viewport + pad) - inset, pad - inset);
            cell.setClip(masks[i]);
            cell.drawImage(fg, 0, 0, null);
            cell.dispose();
        }
        g.dispose();
        ImageIO.write(out, "png", new File(args[1]));
        System.out.println("wrote " + args[1]);
    }
}
