<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\CmsController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\RegistrationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['ok' => true]));
Route::get('/cms', [CmsController::class, 'show']);
Route::get('/courses/catalog', [CourseController::class, 'catalog']);
Route::get('/courses/{category}/{specialty}/{course}', [CourseController::class, 'detail']);
Route::post('/course-registrations', [RegistrationController::class, 'store']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::middleware('admin.token')->group(function () {
    Route::get('/admin/content', [CmsController::class, 'adminIndex']);
    Route::put('/admin/page-content', [CmsController::class, 'updatePageContent']);
    Route::put('/admin/pages/{id}', [CmsController::class, 'updatePage']);
    Route::put('/admin/pages/{pageId}/sections/order', [CmsController::class, 'reorderSections']);
    Route::put('/admin/sections/{id}', [CmsController::class, 'updateSection']);
    Route::put('/admin/settings', [CmsController::class, 'updateSettings']);
    Route::post('/admin/media', [MediaController::class, 'store']);
    Route::get('/admin/courses', [CourseController::class, 'adminIndex']);
    Route::post('/admin/course-categories', [CourseController::class, 'createCategory']);
    Route::put('/admin/course-categories/{id}', [CourseController::class, 'updateCategory']);
    Route::post('/admin/course-specialties', [CourseController::class, 'createSpecialty']);
    Route::put('/admin/course-specialties/{id}', [CourseController::class, 'updateSpecialty']);
    Route::post('/admin/courses', [CourseController::class, 'createCourse']);
    Route::put('/admin/courses/{id}', [CourseController::class, 'updateCourse']);
    Route::delete('/admin/courses/{id}', [CourseController::class, 'deleteCourse']);
    Route::delete('/admin/course-categories/{id}', [CourseController::class, 'deleteCategory']);
    Route::delete('/admin/course-specialties/{id}', [CourseController::class, 'deleteSpecialty']);
    Route::get('/admin/course-registrations', [RegistrationController::class, 'index']);
    Route::put('/admin/course-registrations/{id}', [RegistrationController::class, 'update']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});
