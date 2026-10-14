import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const uploadDir = join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  @ApiOperation({ summary: 'Upload medical image (X-Ray, Fingerprint, Patient Photo)' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const randomName = uuidv4();
          cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMime.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPG, PNG, and WebP medical images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file rejected');
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'medverify';

    // If Supabase Storage is configured, upload to bucket
    if (supabaseUrl && supabaseKey) {
      try {
        const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
        const uploadEndpoint = `${cleanBaseUrl}/storage/v1/object/${bucket}/${file.filename}`;
        const fileBuffer = fs.readFileSync(file.path);

        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            'Content-Type': file.mimetype,
            'x-upsert': 'true',
          },
          body: fileBuffer,
        });

        if (res.ok) {
          const publicUrl = `${cleanBaseUrl}/storage/v1/object/public/${bucket}/${file.filename}`;
          this.logger.log(`Uploaded ${file.filename} to Supabase bucket ${bucket}: ${publicUrl}`);
          return {
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            url: publicUrl,
          };
        } else {
          const errorText = await res.text();
          this.logger.error(`Supabase upload failed: ${res.status} - ${errorText}`);
        }
      } catch (err: any) {
        this.logger.error(`Supabase upload error: ${err.message}`);
      }
    }

    // Local fallback
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/api/v1/uploads/file/${file.filename}`,
    };
  }

  @ApiOperation({ summary: 'Serve uploaded medical image' })
  @Get('file/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename to prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '');

    const candidatePaths = [
      join(uploadDir, safeFilename),
      join(process.cwd(), 'assets', safeFilename),
      join(process.cwd(), 'medverify-api', 'assets', safeFilename),
      join(process.cwd(), 'dist', 'assets', safeFilename),
      join(__dirname, 'assets', safeFilename),
      join(__dirname, '../assets', safeFilename),
      join(__dirname, '../../assets', safeFilename),
      join(__dirname, '../../../assets', safeFilename),
      join(__dirname, '../../../../assets', safeFilename),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return res.sendFile(p);
      }
    }

    // Redirect to Supabase Storage if available
    const supabaseUrl = process.env.SUPABASE_URL;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'medverify';
    if (supabaseUrl) {
      const cleanBase = supabaseUrl.replace(/\/+$/, '');
      return res.redirect(`${cleanBase}/storage/v1/object/public/${bucket}/${safeFilename}`);
    }

    throw new NotFoundException('File not found');
  }
}
